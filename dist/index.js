import { createApp, initializeBackend } from "./app.js";
const port = Number(process.env.PORT) || 4000;
await initializeBackend();
const app = createApp();
app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
});
