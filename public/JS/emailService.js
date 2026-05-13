// public/js/emailService.js
const EMAIL_API_URL = '/api/send-email';

export async function send2FACodeByEmail(email, code, userName) {
try {
    const response = await fetch(EMAIL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        type: '2fa',
        to: email,
        name: userName,
        code: code
    })
    });
    const result = await response.json();
    return result.success;
} catch (error) {
    console.error('Erro ao enviar e-mail 2FA:', error);
    return false;
}
}

export async function sendPasswordResetEmail(email, userName, tempPassword) {
try {
    const response = await fetch(EMAIL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        type: 'reset',
        to: email,
        name: userName,
        tempPassword: tempPassword
    })
    });
    const result = await response.json();
    return result.success;
} catch (error) {
    console.error('Erro ao enviar e-mail de reset:', error);
    return false;
}
}

export async function sendAdminResetNotification(adminEmail, userName, tempPassword) {
try {
    const response = await fetch(EMAIL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        type: 'admin_notification',
        to: adminEmail,
        userName: userName,
        tempPassword: tempPassword
    })
    });
    const result = await response.json();
    return result.success;
} catch (error) {
    console.error('Erro ao notificar admin:', error);
    return false;
}
}