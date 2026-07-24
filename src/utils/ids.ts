export function generatePlayerId(): string { return `p${crypto.randomUUID().replaceAll('-', '')}`; }
export function generateReconnectToken(): string { return `r${crypto.randomUUID().replaceAll('-', '')}`; }
export function generateRequestId(): string { return `q${crypto.randomUUID().replaceAll('-', '')}`; }
