import mongoose from "mongoose";
/** Default for local dev — DB name via `dbName` when URI has no /dbname */
export const DEFAULT_MONGODB_URI = "mongodb://localhost:27017/?directConnection=true&ssl=false";
/**
 * Replace Docker-only hostname `mongo` with 127.0.0.1 so connections work on
 * the host machine. Set MONGODB_SKIP_HOST_REWRITE=1 only when the API runs
 * inside Docker and must keep the service name `mongo`.
 */
function resolveMongoUri(raw) {
    if (process.env.MONGODB_SKIP_HOST_REWRITE === "1") {
        return raw;
    }
    if (raw.startsWith("mongodb+srv://")) {
        return raw;
    }
    let out = raw;
    // Replica set / multi-host seeds
    out = out.replace(/,mongo:/g, ",127.0.0.1:");
    out = out.replace(/mongo:27017/g, "127.0.0.1:27017");
    out = out.replace(/@mongo:/g, "@127.0.0.1:");
    out = out.replace(/^mongodb:\/\/mongo:/, "mongodb://127.0.0.1:");
    out = out.replace(/^mongodb:\/\/mongo\//, "mongodb://127.0.0.1/");
    out = out.replace(/^mongodb:\/\/mongo\?/, "mongodb://127.0.0.1?");
    if (out !== raw) {
        console.warn('[care360] Replaced host "mongo" with 127.0.0.1 in MONGODB_URI. ' +
            "Unset MONGODB_SKIP_HOST_REWRITE or see .env.example.");
    }
    return out;
}
function uriHasDatabasePath(uri) {
    if (uri.startsWith("mongodb+srv://")) {
        const pathPart = uri.replace(/^mongodb\+srv:\/\/[^/]+\/?/, "").split("?")[0];
        return pathPart.length > 0 && pathPart !== "/";
    }
    const m = uri.match(/^mongodb:\/\/[^/]+\/+([^?]*)/);
    return Boolean(m?.[1]?.length);
}
/** True if URI still points at Docker service name `mongo` (not "mongodb" in protocol). */
function stillHasDockerMongoHost(uri) {
    if (uri.startsWith("mongodb+srv://"))
        return false;
    return (/^mongodb:\/\/mongo([:/?]|$)/.test(uri) ||
        /@mongo:/.test(uri) ||
        /,mongo:/.test(uri));
}
function isLocalHost(uri) {
    return (uri.includes("127.0.0.1") ||
        uri.includes("localhost") ||
        uri.includes("0.0.0.0"));
}
function redactUri(u) {
    return u.replace(/\/\/([^/@]+)@/, "//***@");
}
export async function connectDb() {
    const raw = process.env.MONGODB_URI ?? DEFAULT_MONGODB_URI;
    const uri = resolveMongoUri(raw);
    if (stillHasDockerMongoHost(uri)) {
        console.error("[care360] FATAL: MONGODB_URI still uses hostname \"mongo\" (Docker-only). " +
            "Use localhost/127.0.0.1 on your machine, or set MONGODB_SKIP_HOST_REWRITE=1 " +
            "only when the API runs inside Docker.");
        throw new Error('MONGODB_URI hostname "mongo" cannot be resolved on this machine');
    }
    const opts = {
        serverSelectionTimeoutMS: 10_000,
        /** Always set for local single-node — avoids topology switching to replica hosts named `mongo` */
        directConnection: !uri.startsWith("mongodb+srv://") &&
            isLocalHost(uri) &&
            process.env.MONGODB_DIRECT_CONNECTION !== "0",
    };
    if (!uriHasDatabasePath(uri)) {
        opts.dbName = process.env.MONGODB_DB ?? "care360";
    }
    console.log(`[care360] Connecting (redacted): ${redactUri(uri)}`);
    await mongoose.connect(uri, opts);
    const dbNote = opts.dbName ? ` db=${opts.dbName}` : "";
    console.log(`MongoDB connected${dbNote} directConnection=${String(opts.directConnection)}`);
}
