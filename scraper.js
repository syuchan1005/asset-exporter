import { setTimeout } from 'timers/promises';
import fs from 'fs/promises';

await fs.mkdir('cookies', { recursive: true });
const mfCookiesPath = 'cookies/mf.json';
const mtCookiesPath = 'cookies/mt.json';

/**
 * 
 * @param {import('playwright-core').Page} page
 */
export const mfLogin = async (page, email, password) => {
    const storedCookies = await fs.readFile(mfCookiesPath, 'utf8').catch(() => '[]').then((s) => JSON.parse(s));

    await page.context().clearCookies();
    await page.context().addCookies(storedCookies);
    await page.goto('https://moneyforward.com/sign_in');
    const isLoggedIn = await page.waitForURL('https://moneyforward.com/', { timeout: 10000 }).then(() => true).catch(() => false);
    if (isLoggedIn) {
        return;
    }

    await page.waitForURL('**/sign_in?client_id=**');

    await page.getByLabel('メールアドレス').fill(email);
    await Promise.all([
        page.waitForURL('**/sign_in/password**'),
        page.keyboard.press('Enter'),
    ]);

    await page.getByLabel('パスワード', { exact: true }).fill(password);
    await Promise.all([
        page.waitForURL('https://moneyforward.com/'),
        page.keyboard.press('Enter'),
    ]);

    await setTimeout(1000);

    const cookies = await page.context().cookies();
    await fs.unlink(mfCookiesPath).catch(() => { });
    await fs.writeFile(mfCookiesPath, JSON.stringify(cookies), 'utf8');
};

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<string>}
 */
export const mfMetric = async (page) => {
    await page.goto('https://moneyforward.com/');
    const values = await page.$$('li.account:has(.amount > .number)').then((elements) => Promise.all(
        elements.map(async (element) => {
            const heading = await element.$('.heading-accounts');
            const name = await heading.$('a[href*="/accounts/"]').then((e) => e.innerText());
            const updatedAt = await heading.$('.date').then((e) => e.innerText()).then((s) => s.match(/\((.+)\)/)[1]);
            const amount = await element.$('.amount > .number').then((e) => e.innerText()).then((t) => Number(t.replaceAll(',', '').slice(0, -1)));
            return { name, updatedAt, amount };
        })
    ));
    const lines = [
        '# HELP moneyforward_current_balance_jpy ホーム > 登録金融機関',
        '# TYPE moneyforward_current_balance_jpy gauge',
        ...values.map(({ name, updatedAt, amount }) => `moneyforward_current_balance_jpy{name="${name}",updated_at="${updatedAt}"} ${amount}`),
    ];
    return lines.join('\n');
};

/**
 * 
 * @param {import('playwright-core').Page} page
 */
export const mtLogin = async (page, email, password) => {
    const storedCookies = await fs.readFile(mtCookiesPath, 'utf8').catch(() => '[]').then((s) => JSON.parse(s));

    await page.context().clearCookies();
    await page.context().addCookies(storedCookies);
    await page.goto('https://app.getmoneytree.com/login');
    const isLoggedIn = await page.waitForURL('https://app.getmoneytree.com/app/trends/net-worth', { timeout: 10000 }).then(() => true).catch(() => false);
    if (isLoggedIn) {
        return;
    }

    await page.waitForURL('**/login?client_id=**');

    await page.getByPlaceholder('メールアドレス').fill(email);
    await page.getByPlaceholder('パスワード').fill(password);
    await page.locator(`input[type='checkbox']`).setChecked(true);
    await page.locator(`button[type='submit']`).click();
    await page.waitForURL('https://app.getmoneytree.com/app/trends/net-worth');

    await setTimeout(1000);

    const cookies = await page.context().cookies();
    await fs.unlink(mtCookiesPath).catch(() => { });
    await fs.writeFile(mtCookiesPath, JSON.stringify(cookies), 'utf8');
};

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<string>}
 */
export const mtMetric = async (page) => {
    await Promise.all([
        page.waitForURL('**/app/vault'),
        page.locator(`a[href='/app/vault']`).click()
    ]);

    await setTimeout(5000);

    const registeredAccounts = await page.$$('mt-credentials > * > ul > li').then((credentials) =>
        Promise.all(
            credentials.map(async (credentials) => {
                const [credentialsName, credentialsTotal] = await credentials.$('.institution-header').then((e) => e.innerText()).then((s) => s.replace('¥', '').split('\n'));
                return {
                    credentialsName,
                    credentialsTotal: Number(credentialsTotal.replaceAll(',', '')),
                    credentials: await credentials.$$('mt-credential').then((credentialList) =>
                        Promise.all(
                            credentialList.map(async (credential) => {
                                const credentialName = await credential.$('.credential-header .credential-display-name').then((e) => e.innerText());
                                const credentialStatus = await credential.$('mt-credential-status-message .row').then((e) => e.innerText()).then((s) => {
                                    const str = s.trim();
                                    if (str.startsWith('前回の更新日 ')) {
                                        return { type: 'updated_at', status: str.slice(7) };
                                    }
                                    return { type: 'error', status: str };
                                });
                                return {
                                    credentialName,
                                    credentialStatus,
                                    accounts: await credential.$$('mt-account').then((accountList) =>
                                        Promise.all(
                                            accountList.map(async (account) => {
                                                const [accountName, accountAmount] = await account.innerText().then((s) => s.trim().split('\n'));
                                                return {
                                                    accountName,
                                                    accountAmount: Number((accountAmount || '0').replace('¥', '').replaceAll(',', '')),
                                                };
                                            }),
                                        ),
                                    ),
                                };
                            }),
                        ),
                    ),
                };
            })
        ),
    );

    const credentialsTotalList = registeredAccounts.map(({ credentialsName, credentialsTotal }) => ({ credentialsName, credentialsTotal }));
    const accounts = registeredAccounts.flatMap(({ credentialsName, credentials }) =>
        credentials.flatMap(({ credentialName, credentialStatus, accounts }) =>
            accounts.map(({ accountName, accountAmount }) => ({
                credentialsName,
                credentialName,
                credentialStatus,
                accountName,
                accountAmount,
            })),
        ),
    );

    const lines = [
        '# HELP moneytree_current_balance_total_jpy 口座残高合計',
        '# TYPE moneytree_current_balance_total_jpy gauge',
        ...credentialsTotalList.map(({ credentialsName, credentialsTotal }) =>
            `moneytree_current_balance_total_jpy{credentials_name="${credentialsName}"} ${credentialsTotal}`
        ),
        '# HELP moneytree_current_balance_jpy 口座残高',
        '# TYPE moneytree_current_balance_jpy gauge',
        ...accounts.map(({ credentialsName, credentialName, credentialStatus, accountName, accountAmount }) =>
            `moneytree_current_balance_jpy{credentials_name="${credentialsName}",credential_name="${credentialName}",credential_${credentialStatus.type}="${credentialStatus.status}",account_name="${accountName}"} ${accountAmount}`
        ),
    ];
    return lines.join('\n');
};
