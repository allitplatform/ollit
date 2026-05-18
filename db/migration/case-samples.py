#!/usr/bin/env python3
"""유솔N 시트 7가지 미검증 케이스 1건씩 샘플 SQL 생성 (Fix #31).

7가지 케이스:
  1. 다중 row 그룹 (본작업 + 추가선택)
  2. 작업완료 + completed_at
  3. 현금접수 (usol_h)
  4. 추가선택/냉매점검 (→ refrigerant)
  5. 추가선택/송풍팬분해·실외기·피톤치드 (→ cleaning)
  6. 미배정 (assigned_engineer_id=NULL)
  7. spec 외 appliance (2way / 대형실외기)

migrate-usol-may.py 헬퍼 import 후 7건 식별 + SQL 생성.
출력: db/migration/usol-may-dry7.sql
"""

import importlib.util
import sys
import io
from collections import defaultdict
from datetime import datetime
import openpyxl

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# migrate-usol-may.py 모듈 import (dash 파일명 spec 방식)
spec = importlib.util.spec_from_file_location("m", "db/migration/migrate-usol-may.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

# ============================================
# 시트 분석 + 그룹핑
# ============================================
wb = openpyxl.load_workbook('db/migration/usol-may-v2.xlsx', read_only=True, data_only=True)
ws = wb['시트1']
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

groups = defaultdict(list)
order_seq = []
for r in data:
    on = r[IDX['주문번호']]
    if on not in groups:
        order_seq.append(on)
    groups[on].append(r)

# ============================================
# 7가지 케이스 1건씩 식별
# ============================================
cases = []
seen = set()

# CASE 1: 다중 row 그룹
for on in order_seq:
    if len(groups[on]) > 1:
        cases.append(('1', f'다중 row 그룹 ({len(groups[on])} rows, 본작업+추가선택)', on))
        seen.add(on)
        break

# CASE 2: 작업완료 + completed_at
for on in order_seq:
    if on in seen:
        continue
    main = groups[on][0]
    if main[IDX['상태']] == '작업완료' and main[IDX['작업완료일']]:
        cases.append(('2', '작업완료 + completed_at 채워짐', on))
        seen.add(on)
        break

# CASE 3: 현금접수 (usol_h)
for on in order_seq:
    if on in seen:
        continue
    if groups[on][0][IDX['채널']] == '현금접수':
        cases.append(('3', '현금접수 → principal_code=usol_h', on))
        seen.add(on)
        break

# CASE 4: 추가선택 / 냉매점검
for on in order_seq:
    if on in seen:
        continue
    has_refri = any(
        r[IDX['서비스종류']] == '추가선택' and '냉매' in (r[IDX['서비스구분']] or '')
        for r in groups[on]
    )
    if has_refri:
        cases.append(('4', '추가선택/냉매점검 → service_type=refrigerant', on))
        seen.add(on)
        break

# CASE 5: 추가선택 / 송풍팬분해·실외기·피톤치드
for on in order_seq:
    if on in seen:
        continue
    has_other = any(
        r[IDX['서비스종류']] == '추가선택'
        and '냉매' not in (r[IDX['서비스구분']] or '')
        and any(k in (r[IDX['서비스구분']] or '') for k in ['송풍팬분해', '실외기', '피톤치드'])
        for r in groups[on]
    )
    if has_other:
        cases.append(('5', '추가선택/송풍팬분해·실외기·피톤치드 → service_type=cleaning', on))
        seen.add(on)
        break

# CASE 6: 미배정
for on in order_seq:
    if on in seen:
        continue
    if not groups[on][0][IDX['배정기사']]:
        cases.append(('6', '미배정 → assigned_engineer_id=NULL', on))
        seen.add(on)
        break

# CASE 7: spec 외 appliance (2way / 대형실외기)
for on in order_seq:
    if on in seen:
        continue
    has_unknown = any(
        any(k in (r[IDX['서비스구분']] or '') for k in ['2way', '대형실외기'])
        for r in groups[on]
    )
    if has_unknown:
        cases.append(('7', 'spec 외 appliance → appliance_type_id=NULL', on))
        seen.add(on)
        break

# 식별 결과 출력
print('식별된 7건:')
for case_no, desc, on in cases:
    rs = groups[on]
    main = rs[0]
    print(f'  CASE {case_no}: {desc}')
    print(f'    order_no={on} / task_no={main[IDX["작업코드"]]} / items={len(rs)} / 채널={main[IDX["채널"]]} / 상태={main[IDX["상태"]]} / 기사={main[IDX["배정기사"]]}')
    for i, r in enumerate(rs):
        print(f'      row{i+1}: 서비스={r[IDX["서비스종류"]]} / 구분={r[IDX["서비스구분"]]} / qty={r[IDX["수량"]]} / 금액={r[IDX["최종상품금액"]]}')

# ============================================
# SQL 생성 (m 헬퍼 재사용)
# ============================================
out = []
out.append("-- ============================================")
out.append("-- 유솔N 시트 → Supabase tasks/task_items 마이그 (Fix #31)")
out.append("-- DRY RUN 7건 — 각 미검증 케이스 1건씩")
out.append(f"-- 생성: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
out.append("-- 원본: db/migration/usol-may-v2.xlsx 시트 '시트1' (1,143건 중 7건 샘플)")
out.append("-- ============================================")
out.append("")
out.append("BEGIN;")
out.append("")

skipped = set()
for case_no, desc, order_no in cases:
    group_rows = groups[order_no]
    main = group_rows[0]
    task_no = main[IDX['작업코드']]
    channel = main[IDX['채널']]
    principal_code = m.CHANNEL_MAP.get(channel, 'usol_n')
    engineer_name = main[IDX['배정기사']]
    engineer_uuid = m.ENGINEER_MAP.get(engineer_name) if engineer_name else None
    if engineer_name and not engineer_uuid:
        skipped.add(engineer_name)
    status_raw = main[IDX['상태']]
    status = m.STATUS_MAP.get(status_raw, status_raw or '미배정')
    scheduled_at = m.sql_scheduled_at(main[IDX['요청일자']], main[IDX['기사약속시간']])
    completed_at = m.sql_timestamp_kst(main[IDX['작업완료일']])
    recommend = m.parse_recommend(main[IDX['추천기사']])

    out.append("-- ============================================")
    out.append(f"-- CASE {case_no}: {desc}")
    out.append(f"-- order_no={order_no} / task_no={task_no} / channel={channel} / 상태={status_raw} / items={len(group_rows)}")
    out.append("-- ============================================")
    out.append("INSERT INTO tasks (")
    out.append("  tenant_id, category_id, principal_id, task_no,")
    out.append("  external_order_no, customer_name, phone, address, district,")
    out.append("  request_note, status, assigned_engineer_id,")
    out.append("  scheduled_at, completed_at,")
    out.append("  product_price, extra_fee, extra_reason,")
    out.append("  push_candidates, category_data")
    out.append(") VALUES (")
    out.append(f"  '{m.TENANT_ID}', '{m.CATEGORY_ID}', {m.principal_id_sub(principal_code)},")
    out.append(f"  {m.sql_str(task_no)}, {m.sql_str(order_no)},")
    out.append(f"  {m.sql_str(main[IDX['수취인명']])}, {m.sql_str(main[IDX['수취인연락처1']])},")
    out.append(f"  {m.sql_str(main[IDX['주소']])}, {m.sql_str(main[IDX['지역키워드']])},")
    out.append(f"  {m.sql_str(main[IDX['배송메세지']])}, {m.sql_str(status)},")
    out.append(f"  {m.sql_str(engineer_uuid) if engineer_uuid else 'NULL'},")
    out.append(f"  {scheduled_at}, {completed_at},")
    out.append(f"  {m.sql_num(main[IDX['최종상품금액']])}, {m.sql_num(main[IDX['현장추가금액']])},")
    out.append(f"  {m.sql_str(main[IDX['현장추가옵션명']])},")
    out.append(f"  {m.sql_jsonb_array(recommend)}, '{{}}'::jsonb")
    out.append(");")
    out.append("")

    for idx, r in enumerate(group_rows):
        service_kind = r[IDX['서비스종류']]
        work_type_str = r[IDX['서비스구분']]
        qty = r[IDX['수량']] or 1
        service_code, appliance_code = m.lookup_service_appliance(service_kind, work_type_str)
        work_type_code = m.WORK_TYPE_CODE_MAP.get((service_code, appliance_code))

        item_code = r[IDX['작업코드']]
        ext_item_no = r[IDX['상품주문번호']]
        metadata = {}
        if item_code:
            metadata['item_code'] = str(item_code)
        if ext_item_no:
            metadata['external_item_no'] = str(ext_item_no)
        if not work_type_code:
            metadata['raw_service'] = str(service_kind) if service_kind else ''
            metadata['raw_appliance'] = str(work_type_str) if work_type_str else ''

        out.append(f"-- item {idx+1}/{len(group_rows)}: 서비스={service_kind} / 구분={work_type_str} / qty={qty} → work_type={work_type_code or 'NULL'} / appliance={appliance_code or 'NULL'}")
        out.append("INSERT INTO task_items (task_id, qty, unit_price, work_type_id, appliance_type_id, metadata)")
        out.append("SELECT")
        out.append(f"  t.id, {m.sql_num(qty)}, 0,")
        out.append(f"  {m.work_type_id_sub(service_code, appliance_code)},")
        out.append(f"  {m.appliance_type_id_sub(appliance_code)},")
        out.append(f"  {m.sql_jsonb_obj(metadata)}")
        out.append(f"FROM tasks t WHERE t.task_no = {m.sql_str(task_no)} AND t.tenant_id = '{m.TENANT_ID}';")
    out.append("")

out.append("COMMIT;")
out.append("")
if skipped:
    out.append("-- ============================================")
    out.append("-- ⚠️ ENGINEER_MAP 누락 기사 (assigned_engineer_id=NULL 처리됨):")
    for n in sorted(skipped):
        out.append(f"--   {n!r}")
    out.append("-- ============================================")

sql_text = '\n'.join(out)
with open('db/migration/usol-may-dry7.sql', 'w', encoding='utf-8') as f:
    f.write(sql_text)
print(f'\nwrote db/migration/usol-may-dry7.sql ({len(sql_text)} chars, {sql_text.count(chr(10))+1} lines)')
