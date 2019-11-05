"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tls_1 = require("tls");
/**
 * Returns a string describing the encryption on a given socket instance.
 */
function describeTLS(socket) {
    if (socket instanceof tls_1.TLSSocket) {
        const protocol = socket.getProtocol();
        return protocol ? protocol : "Server socket or disconnected client socket";
    }
    return "No encryption";
}
exports.describeTLS = describeTLS;
/**
 * Returns a string describing the remote address of a socket.
 */
function describeAddress(socket) {
    if (socket.remoteFamily === "IPv6") {
        return `[${socket.remoteAddress}]:${socket.remotePort}`;
    }
    return `${socket.remoteAddress}:${socket.remotePort}`;
}
exports.describeAddress = describeAddress;
/**
 * Upgrade a socket connection with TLS.
 */
function upgradeSocket(socket, options) {
    return new Promise((resolve, reject) => {
        const tlsOptions = Object.assign({}, options, {
            socket
        });
        const tlsSocket = tls_1.connect(tlsOptions, () => {
            const expectCertificate = tlsOptions.rejectUnauthorized !== false;
            if (expectCertificate && !tlsSocket.authorized) {
                reject(tlsSocket.authorizationError);
            }
            else {
                // Remove error listener added below.
                tlsSocket.removeAllListeners("error");
                resolve(tlsSocket);
            }
        }).once("error", error => {
            reject(error);
        });
    });
}
exports.upgradeSocket = upgradeSocket;
