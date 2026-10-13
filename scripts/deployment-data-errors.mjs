export const failure = (code, message) => Object.assign(new Error(message), { recoveryCode: code });
