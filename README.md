# asset-exporter

Scrape asset-data from MoneyForward and MoneyTree

NOTE: This exporter scrapes on-demand, no-cache.

Sample metric:
```
# MoneyForward
# HELP moneyforward_current_balance_jpy ホーム > 登録金融機関
# TYPE moneyforward_current_balance_jpy gauge
moneyforward_current_balance_jpy{name="A銀行",updated_at="06/20 06:52"} 100
# MoneyTree
# HELP moneytree_current_balance_total_jpy 口座残高合計
# TYPE moneytree_current_balance_total_jpy gauge
moneytree_current_balance_total_jpy{credentials_name="銀行"} 100
moneytree_current_balance_total_jpy{credentials_name="クレジットカード"} -200
moneytree_current_balance_total_jpy{credentials_name="証券、保険"} 300
moneytree_current_balance_total_jpy{credentials_name="その他"} 0
moneytree_current_balance_total_jpy{credentials_name="電子マネー"} 400
# HELP moneytree_current_balance_jpy 口座残高
# TYPE moneytree_current_balance_jpy gauge
moneytree_current_balance_jpy{credentials_name="銀行",credential_name="A銀行",credential_updated_at="2024/06/14",account_name="普通預金"} 100
moneytree_current_balance_jpy{credentials_name="銀行",credential_name="B銀行",credential_error="接続中",account_name="残高別普通"} 500
```
