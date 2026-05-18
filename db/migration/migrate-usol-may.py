#!/usr/bin/env python3
"""유솔N 시트 → Supabase tasks/task_items 변환 스크립트 (Fix #31).

사용:
  python db/migration/migrate-usol-may.py                       # DRY RUN 5건 → stdout
  python db/migration/migrate-usol-may.py --limit 100           # 처음 100건
  python db/migration/migrate-usol-may.py --limit 0             # 전체 1,143건
  python db/migration/migrate-usol-may.py --output db/migration/usol-may.sql

생성 SQL은 BEGIN/COMMIT 트랜잭션으로 감싸인 INSERT INTO tasks + task_items.
Supabase에는 직접 INSERT 안 함 — 사장님이 SQL 파일을 콘솔에서 실행.
"""

import openpyxl
import sys
import argparse
import json
from datetime import datetime
from collections import defaultdict

# ============================================
# 매핑 dict (사장님 spec)
# ============================================

# 시트 16명 이름 → user UUID (db/migrations/004_seed.sql 기준)
# 시트 '유근학' = DB '류근학' E016 (시트 오타 — 동일 인물)
ENGINEER_MAP = {
    '전현진': '77777777-7777-7777-7777-7777777e0019',
    '정훈':   '77777777-7777-7777-7777-7777777e0021',
    '임종일': '77777777-7777-7777-7777-7777777e0018',
    '유근학': '77777777-7777-7777-7777-7777777e0016',
    '김윤섭': '77777777-7777-7777-7777-7777777e0008',
    '김재현': '77777777-7777-7777-7777-7777777e0009',
    '김병철': '77777777-7777-7777-7777-7777777e0006',
    '김경호': '77777777-7777-7777-7777-7777777e0004',
    '김동효': '77777777-7777-7777-7777-7777777e0005',
    '정상현': '77777777-7777-7777-7777-7777777e0020',
    '안승웅': '77777777-7777-7777-7777-7777777e0014',
    '양승문': '77777777-7777-7777-7777-7777777e0015',
    '김영수': '77777777-7777-7777-7777-7777777e0007',
    '김현동': '77777777-7777-7777-7777-7777777e0011',
    '권창용': '77777777-7777-7777-7777-7777777e0003',
    '이상준': '77777777-7777-7777-7777-7777777e0017',
}

CHANNEL_MAP = {
    '네이버':   'usol_n',
    '현금접수': 'usol_h',
}

STATUS_MAP = {
    # DB CHECK 제약 (001_init.sql:157): ('미배정','약속대기','확정','진행중','완료','취소')
    # 시트 5개 unique status → DB 허용 6개 안에서 매핑.
    '기사배정완료': '확정',     # 사장님 코드/UI에서는 scheduled_at + engineer로 단계 구분
    '일정확정':     '확정',
    '작업완료':     '완료',
    '취소':         '취소',
    '접수':         '미배정',
}

# 시트 (서비스종류, 서비스구분) → (service_type.code, appliance_type.code) 통합 매핑.
#
# 2026-05-18 Fix #31 사장님 정정:
#   - 본작업 (가정집/사무실 청소) → cleaning + appliance
#   - 추가선택 옵션 1:1 매핑 (cleaning 통합 X — Migration 034 신규 service_types):
#     · 송풍팬분해/층고  → fan_disassembly
#     · 실외기           → outdoor_unit
#     · 피톤치드         → phytoncide
#     · 냉매점검         → refrigerant (기존)
#     · 벽걸이 (1건 이상 입력 — 본작업 가정) → cleaning + wall
#   - 서울지역 (1건)     → refrigerant (통합)
#   - DB에 없는 appliance ('2way', '대형실외기' 등 2건) → NULL (raw 메타 보존)

APPLIANCE_KEYWORDS = [
    ('벽걸이',  'wall'),
    ('1way',    '1way'),
    ('스탠드',  'stand'),
    ('4way',    '4way'),
    ('원형',    'round'),
    ('투인원',  '2in1'),
    ('시스템',  'multi'),
]

def _appliance_from_keyword(work_type_str):
    if not work_type_str:
        return None
    for keyword, code in APPLIANCE_KEYWORDS:
        if keyword in work_type_str:
            return code
    return None

def lookup_service_appliance(service_kind, work_type_str):
    """(서비스종류, 서비스구분) → (service_code, appliance_code) tuple.

    매핑 누락 시 (None, None) 반환 → 호출처가 raw 메타 보존 처리.
    """
    if service_kind in ('가정집 에어컨청소', '사무실 에어컨청소'):
        return ('cleaning', _appliance_from_keyword(work_type_str))

    if service_kind == '추가선택':
        s = work_type_str or ''
        if s == '벽걸이':
            return ('cleaning', 'wall')   # 이상 입력 1건 → 본작업 처리
        if '냉매' in s:
            return ('refrigerant', None)
        if '송풍팬분해' in s:
            return ('fan_disassembly', None)
        if '실외기' in s:
            return ('outdoor_unit', None)
        if '피톤치드' in s:
            return ('phytoncide', None)
        return (None, None)

    if service_kind == '서울지역':
        return ('refrigerant', None)

    return (None, None)

# Phase 1 MVP 상수 (tasksDb.js TENANT_ID / CATEGORY_ID_AIRCON과 일치)
TENANT_ID = '11111111-1111-1111-1111-111111111111'
CATEGORY_ID = '33333333-3333-3333-3333-333333333001'

# ============================================
# SQL escape 헬퍼
# ============================================
def sql_str(v):
    if v is None or v == '':
        return 'NULL'
    s = str(v).replace("'", "''")
    return f"'{s}'"

def sql_num(v):
    if v is None or v == '':
        return 'NULL'
    try:
        if isinstance(v, float) and v.is_integer():
            return str(int(v))
        return str(v)
    except (ValueError, TypeError):
        return 'NULL'

def sql_timestamp_kst(v):
    """datetime 또는 str ('2026.05.18' 등) → KST timestamptz 리터럴.

    시트의 작업완료일 등은 대부분 str ('%Y.%m.%d' 형식)이라 parsing fallback 필요.
    """
    if v is None or v == '':
        return 'NULL'
    if isinstance(v, datetime):
        return f"'{v.strftime('%Y-%m-%d %H:%M:%S')}+09:00'"
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return 'NULL'
        for fmt in ('%Y.%m.%d %H:%M:%S', '%Y.%m.%d %H:%M', '%Y.%m.%d',
                    '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
            try:
                dt = datetime.strptime(s, fmt)
                return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}+09:00'"
            except ValueError:
                continue
    return 'NULL'

def sql_scheduled_at(date_v, time_str):
    if not time_str or time_str == '00:00':
        return 'NULL'
    if not isinstance(date_v, datetime):
        return 'NULL'
    try:
        h, m = str(time_str).split(':')
        dt = date_v.replace(hour=int(h), minute=int(m), second=0, microsecond=0)
        return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}+09:00'"
    except (ValueError, AttributeError):
        return 'NULL'

def sql_jsonb_array(items):
    if not items:
        return "'[]'::jsonb"
    arr = json.dumps(items, ensure_ascii=False)
    escaped = arr.replace("'", "''")
    return f"'{escaped}'::jsonb"

def parse_recommend(raw):
    if not raw:
        return []
    s = str(raw).replace('/', ',')
    return [n.strip() for n in s.split(',') if n.strip()]

# ============================================
# subquery 헬퍼 (FK lookup)
# ============================================
def principal_id_sub(code):
    return f"(SELECT id FROM principals WHERE code='{code}' AND tenant_id='{TENANT_ID}' LIMIT 1)"

def service_type_id_sub(code):
    if not code:
        return 'NULL'
    return f"(SELECT id FROM service_types WHERE code='{code}' AND category_id='{CATEGORY_ID}' LIMIT 1)"

def appliance_type_id_sub(code):
    if not code:
        return 'NULL'
    return f"(SELECT id FROM appliance_types WHERE code='{code}' AND category_id='{CATEGORY_ID}' LIMIT 1)"

# (service_code, appliance_code) → work_types.code
# 기존 004_seed.sql 13개 + Migration 034 신규 4개 (모두 appliance NULL)
WORK_TYPE_CODE_MAP = {
    # 004_seed.sql 시드
    ('cleaning',    'wall'):  'clean_wall',
    ('cleaning',    '1way'):  'clean_1way',
    ('cleaning',    'stand'): 'clean_stand',
    ('cleaning',    '4way'):  'clean_4way',
    ('cleaning',    'round'): 'clean_round',
    ('cleaning',    '2in1'):  'clean_2in1',
    ('cleaning',    'multi'): 'clean_multi',
    ('refrigerant', 'wall'):  'refri_wall',
    ('refrigerant', '1way'):  'refri_1way',
    ('refrigerant', 'stand'): 'refri_stand',
    ('refrigerant', '4way'):  'refri_4way',
    ('refrigerant', '2in1'):  'refri_2in1',
    # Migration 034 신규 (Fix #31 추가선택 옵션 시드)
    ('refrigerant',     None): 'refri_no_appliance',
    ('fan_disassembly', None): 'fan_disassembly',
    ('outdoor_unit',    None): 'outdoor_unit',
    ('phytoncide',      None): 'phytoncide',
}

def work_type_id_sub(service_code, appliance_code):
    """(service, appliance) 조합 → work_types.id subquery. 매핑 없으면 NULL."""
    work_type_code = WORK_TYPE_CODE_MAP.get((service_code, appliance_code))
    if not work_type_code:
        return 'NULL'
    return f"(SELECT id FROM work_types WHERE code='{work_type_code}' LIMIT 1)"

def sql_jsonb_obj(obj):
    """dict → jsonb 리터럴 (한국어 escape 처리)."""
    if not obj:
        return "'{}'::jsonb"
    j = json.dumps(obj, ensure_ascii=False)
    return f"'{j.replace(chr(39), chr(39)*2)}'::jsonb"

# ============================================
# 변환 메인
# ============================================
def convert(xlsx_path, sheet_name, limit=None, skip=0):
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    headers = list(rows[0])

    def col(name):
        return headers.index(name) if name in headers else -1

    IDX = {k: col(k) for k in [
        '채널', '작업코드', '주문번호', '상품주문번호',
        '수취인명', '수취인연락처1',
        '서비스종류', '서비스구분', '수량',
        '주소', '배송메세지', '지역키워드',
        '추천기사', '배정기사', '상태',
        '요청일자', '기사약속시간', '작업완료일',
        '최종상품금액', '현장추가옵션명', '현장추가금액',
    ]}

    data = [r for r in rows[1:] if r and not all(v is None for v in r)]
    wb.close()

    # 주문번호 그룹핑 (1 주문번호 = 1 task + N task_items)
    groups = defaultdict(list)
    order_seq = []  # 시트 출현 순서 보존
    for r in data:
        on = r[IDX['주문번호']]
        if on not in groups:
            order_seq.append(on)
        groups[on].append(r)

    # task 순서 (시트 출현 순서) 보존, skip 후 limit 적용
    target_orders = order_seq[skip:]
    if limit is not None:
        target_orders = target_orders[:limit]

    out = []
    out.append("-- ============================================")
    out.append("-- 유솔N 시트 → Supabase tasks/task_items 마이그 (Fix #31)")
    out.append(f"-- 생성: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    out.append(f"-- 원본: {xlsx_path} 시트 {sheet_name!r}")
    out.append(f"-- 시트 데이터 {len(data)}건 → tasks {len(groups)}개")
    out.append(f"-- 출력 범위: skip={skip}, limit={limit or '전체'} → {len(target_orders)} task")
    out.append("-- ============================================")
    out.append("")
    out.append("BEGIN;")
    out.append("")

    skipped_engineers = set()

    for idx, order_no in enumerate(target_orders):
        task_seq = skip + idx + 1   # 시트 기준 절대 task 번호 (사장님 추적 용이)
        group_rows = groups[order_no]
        main = group_rows[0]  # 본작업 = 그룹 첫 row

        task_no = main[IDX['작업코드']]
        channel = main[IDX['채널']]
        principal_code = CHANNEL_MAP.get(channel, 'usol_n')

        engineer_name = main[IDX['배정기사']]
        engineer_uuid = None
        if engineer_name:
            engineer_uuid = ENGINEER_MAP.get(engineer_name)
            if not engineer_uuid:
                skipped_engineers.add(engineer_name)

        status_raw = main[IDX['상태']]
        # CHECK 제약 통과 보장: STATUS_MAP 미정의 값은 안전한 default ('미배정')로 매핑
        status = STATUS_MAP.get(status_raw, '미배정')

        scheduled_at = sql_scheduled_at(main[IDX['요청일자']], main[IDX['기사약속시간']])
        completed_at = sql_timestamp_kst(main[IDX['작업완료일']])
        recommend = parse_recommend(main[IDX['추천기사']])

        out.append(f"-- [{task_seq}] order_no={order_no}, task_no={task_no}, channel={channel}, items={len(group_rows)}")
        out.append("INSERT INTO tasks (")
        out.append("  tenant_id, category_id, principal_id, task_no,")
        out.append("  external_order_no, customer_name, phone, address, district,")
        out.append("  request_note, status, assigned_engineer_id,")
        out.append("  scheduled_at, completed_at,")
        out.append("  product_price, extra_fee, extra_reason,")
        out.append("  push_candidates, category_data")
        out.append(") VALUES (")
        out.append(f"  '{TENANT_ID}', '{CATEGORY_ID}', {principal_id_sub(principal_code)},")
        out.append(f"  {sql_str(task_no)}, {sql_str(order_no)},")
        out.append(f"  {sql_str(main[IDX['수취인명']])}, {sql_str(main[IDX['수취인연락처1']])},")
        out.append(f"  {sql_str(main[IDX['주소']])}, {sql_str(main[IDX['지역키워드']])},")
        out.append(f"  {sql_str(main[IDX['배송메세지']])}, {sql_str(status)},")
        out.append(f"  {sql_str(engineer_uuid) if engineer_uuid else 'NULL'},")
        out.append(f"  {scheduled_at}, {completed_at},")
        out.append(f"  {sql_num(main[IDX['최종상품금액']])}, {sql_num(main[IDX['현장추가금액']])},")
        out.append(f"  {sql_str(main[IDX['현장추가옵션명']])},")
        out.append(f"  {sql_jsonb_array(recommend)}, '{{}}'::jsonb")
        out.append(");")
        out.append("")

        # task_items — 그룹 모든 row (본작업 + 추가선택)
        # 각 row의 작업코드/상품주문번호는 metadata jsonb로 보존 (Migration 033).
        for r in group_rows:
            service_kind = r[IDX['서비스종류']]
            work_type_str = r[IDX['서비스구분']]
            qty = r[IDX['수량']] or 1
            service_code, appliance_code = lookup_service_appliance(service_kind, work_type_str)
            work_type_code = WORK_TYPE_CODE_MAP.get((service_code, appliance_code))

            item_code = r[IDX['작업코드']]
            ext_item_no = r[IDX['상품주문번호']]
            metadata = {}
            if item_code:
                metadata['item_code'] = str(item_code)
            if ext_item_no:
                metadata['external_item_no'] = str(ext_item_no)
            # 매핑 누락 시 원본 보존
            if not work_type_code:
                metadata['raw_service'] = str(service_kind) if service_kind else ''
                metadata['raw_appliance'] = str(work_type_str) if work_type_str else ''

            out.append(f"-- item: 서비스={service_kind} / 구분={work_type_str} / qty={qty} → work_type={work_type_code or 'NULL'} / appliance={appliance_code or 'NULL'}")
            out.append("INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)")
            out.append("SELECT")
            out.append(f"  t.id, {sql_num(qty)}, 0,")
            out.append(f"  {work_type_id_sub(service_code, appliance_code)},")
            out.append(f"  {appliance_type_id_sub(appliance_code)},")
            out.append(f"  {sql_jsonb_obj(metadata)}")
            out.append(f"FROM tasks t WHERE t.task_no = {sql_str(task_no)} AND t.tenant_id = '{TENANT_ID}';")
        out.append("")

    out.append("COMMIT;")
    out.append("")
    if skipped_engineers:
        out.append("-- ============================================")
        out.append("-- ⚠️ ENGINEER_MAP 누락 기사 (assigned_engineer_id=NULL 처리됨):")
        for name in sorted(skipped_engineers):
            out.append(f"--   {name!r}")
        out.append("-- ============================================")

    return '\n'.join(out)

# ============================================
# CLI
# ============================================
if __name__ == '__main__':
    p = argparse.ArgumentParser(description='유솔N 시트 → SQL 변환')
    p.add_argument('--xlsx',  default='db/migration/usol-may-v2.xlsx', help='입력 xlsx 경로')
    p.add_argument('--sheet', default='시트1', help='시트 이름')
    p.add_argument('--limit', type=int, default=5, help='샘플 task 개수 (0=전체)')
    p.add_argument('--skip',  type=int, default=0, help='처음 N task 스킵 (이미 마이그한 분량)')
    p.add_argument('--output', default=None, help='SQL 출력 파일 (생략 시 stdout)')
    args = p.parse_args()

    limit = args.limit if args.limit > 0 else None
    sql = convert(args.xlsx, args.sheet, limit=limit, skip=args.skip)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(sql)
        print(f'wrote {args.output} ({len(sql)} chars)', file=sys.stderr)
    else:
        print(sql)
