# Troubleshooting

| Symptom | What to do |
| --- | --- |
| Blank page after double-clicking HTML | Serve the complete folder using the README's Python command; open its localhost URL. |
| Import fails or returns HTML | Check the server root, filename case and JavaScript MIME type. Read the browser console for the actual missing path. |
| Tutorial download stays disabled | Apply a speed different from the starter, test, try zero speed, repair with a positive changed speed and test again. Edits invalidate tests. |
| Player will not move | Read Scene checks. Ensure a visible Player, positive controller speed and supported ground. Focus the Play canvas and resume after blur. |
| Rotated platform is not solid | The preview ignores arbitrary-angle static collision. Use Y rotation 0 or 180; see the Workbench limits. |
| Mod or project rejected | Keep your accepted project; read the error. Use the receiving tool's supported schema and byte bounds, not another lab's format. |
| Export refuses a folder | Choose a new output path. The exporter intentionally does not overwrite existing work. |
| Offline reload fails | Build first, serve the entire output on localhost or HTTPS, await worker installation and reload before disconnecting. Private browsing/storage settings may prevent caching. |
| Old offline content | First check the server version in a fresh private window. After the replacement package installs, close **all** VANILLAJS tabs and reopen; refresh alone may retain the active offline worker. Save projects before considering site-data removal. |
| HORIZON only rotates the camera around a parked car | The old **Coastline Atelier** page is the scenery workshop. The canonical URL should show **Racing Foundry** and a Start race control. Check the latest main Pages deployment; a failed verification leaves the previous site live. See [the deployment diagnosis](HORIZON_DEPLOYMENT.md). |
| Canvas unavailable | Use a browser with Canvas support and inspect the reported error. Do not infer a completed tutorial test from a blank image. |
| Node tool fails immediately | Check `node --version`; tools require Node 22+ and commands run from the repository root. |
| Browser verifier cannot find Playwright | Use the existing externally installed, pinned CI tooling. Do not install runtime dependencies or dispatch owner-only hardware workflows. |

[Start here](START_HERE.md) · [Creator reference](CREATOR_GUIDE.md) ·
[Workbench limits](EDITOR_WORKBENCH.md) · [Verification history](VERIFICATION.md)
