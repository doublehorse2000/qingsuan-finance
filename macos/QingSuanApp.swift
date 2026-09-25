import Cocoa
import WebKit

final class ResourceSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url, url.host == "app",
              let root = Bundle.main.resourceURL?.appendingPathComponent("web", isDirectory: true) else {
            urlSchemeTask.didFailWithError(NSError(domain: "QingSuan", code: 1, userInfo: [NSLocalizedDescriptionKey: "应用资源目录不存在"]))
            return
        }

        let safePath = url.path == "/" || url.path.isEmpty ? "index.html" : String(url.path.drop(while: { $0 == "/" }))
        let fileURL = root.appendingPathComponent(safePath).standardizedFileURL
        guard fileURL.path.hasPrefix(root.standardizedFileURL.path + "/"), let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(NSError(domain: "QingSuan", code: 2, userInfo: [NSLocalizedDescriptionKey: "资源不存在: \(safePath)"]))
            return
        }

        let mime: String
        switch fileURL.pathExtension.lowercased() {
        case "html": mime = "text/html"
        case "js": mime = "text/javascript"
        case "css": mime = "text/css"
        case "json": mime = "application/json"
        default: mime = "application/octet-stream"
        }
        let response = URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: "utf-8")
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = WKWebsiteDataStore.default()
        configuration.setURLSchemeHandler(ResourceSchemeHandler(), forURLScheme: "qingsuan")
        let contentController = configuration.userContentController
        contentController.add(self, name: "nativeLog")
        contentController.add(self, name: "saveFile")
        contentController.addUserScript(WKUserScript(source: """
            window.__qingsuanSaveResolvers = {};
            window.__qingsuanResolveSave = function (result) {
                var entry = window.__qingsuanSaveResolvers[result.id];
                if (!entry) return;
                delete window.__qingsuanSaveResolvers[result.id];
                entry.resolve(result);
            };
            window.qingsuanDesktop = {
                saveFile: function (request) {
                    return new Promise(function (resolve, reject) {
                        var id = 'save-' + Date.now() + '-' + Math.random().toString(16).slice(2);
                        window.__qingsuanSaveResolvers[id] = { resolve: resolve, reject: reject };
                        window.webkit.messageHandlers.saveFile.postMessage({ id: id, filename: request.filename, content: request.content, mimeType: request.mimeType });
                    });
                }
            };
            function qingsuanReport(message) {
                window.webkit.messageHandlers.nativeLog.postMessage(String(message));
                var render = function () {
                    if (document.body) {
                        var notice = document.getElementById('qingsuan-load-error') || document.createElement('pre');
                        notice.id = 'qingsuan-load-error';
                        notice.style.cssText = 'position:fixed;inset:16px 16px auto;z-index:9999;padding:24px;color:#a33;background:white;white-space:pre-wrap;font:14px -apple-system';
                        notice.textContent = '清算遇到错误，请先备份数据再重新打开应用。\\n\\n' + String(message);
                        document.body.appendChild(notice);
                    }
                };
                if (document.body) render(); else document.addEventListener('DOMContentLoaded', render, { once: true });
            }
            window.addEventListener('error', function (event) {
                qingsuanReport('JS error: ' + (event.message || 'unknown') + '\\n' + (event.filename || '') + ':' + (event.lineno || '') + ':' + (event.colno || '') + '\\n' + (event.error && event.error.stack || ''));
            });
            window.addEventListener('unhandledrejection', function (event) {
                qingsuanReport('Promise error: ' + String(event.reason));
            });
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = false

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1360, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "清算 · 个人财务管家"
        window.minSize = NSSize(width: 960, height: 640)
        window.center()
        window.isReleasedWhenClosed = false
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)

        webView.load(URLRequest(url: URL(string: "qingsuan://app/index.html")!))
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "saveFile", let request = message.body as? [String: Any] {
            saveFile(request)
            return
        }
        print("QingSuan WebView: \(message.body)")
    }

    private func saveFile(_ request: [String: Any]) {
        guard let id = request["id"] as? String,
              let filename = request["filename"] as? String,
              let content = request["content"] as? String else { return }

        let panel = NSSavePanel()
        panel.title = "导出清算数据"
        panel.nameFieldStringValue = URL(fileURLWithPath: filename).lastPathComponent
        panel.canCreateDirectories = true
        let ext = URL(fileURLWithPath: filename).pathExtension
        if !ext.isEmpty {
            panel.allowedFileTypes = [ext]
        }
        panel.begin { [weak self] response in
            guard let self else { return }
            var saved = false
            var savedPath: String?
            if response == .OK, let url = panel.url {
                do {
                    try Data(content.utf8).write(to: url, options: .atomic)
                    saved = true
                    savedPath = url.path
                } catch {
                    print("QingSuan export failed: \(error.localizedDescription)")
                }
            }
            var result: [String: Any] = ["id": id, "saved": saved]
            if let savedPath { result["path"] = savedPath }
            guard let jsonData = try? JSONSerialization.data(withJSONObject: result),
                  let json = String(data: jsonData, encoding: .utf8) else { return }
            self.webView.evaluateJavaScript("window.__qingsuanResolveSave(\(json));")
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("QingSuan WebView loaded: \(webView.url?.absoluteString ?? "unknown")")
        if let mode = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--smoke-") }) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                let script = """
                (() => {
                    if (!document.querySelector('.app-shell') || !document.querySelector('.recharts-surface')) throw Error('Dashboard or charts missing');
                    if (document.getElementById('qingsuan-load-error')) throw Error('Frontend error');
                    const key = 'qingsuan.smoke.persistence';
                    if ('\(mode)' === '--smoke-write') localStorage.setItem(key, 'persistent');
                    if ('\(mode)' === '--smoke-read') {
                        if (localStorage.getItem(key) !== 'persistent') throw Error('Persistence failed');
                        localStorage.removeItem(key);
                    }
                    return 'PASS: dashboard, charts, ' + '\(mode)';
                })()
                """
                webView.evaluateJavaScript(script) { result, error in
                    if let error = error {
                        fputs("SMOKE FAIL: \(error.localizedDescription)\n", stderr)
                        exit(1)
                    }
                    print(result ?? "Missing result")
                    fflush(stdout)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { NSApp.terminate(nil) }
                }
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("QingSuan WebView failed: \(error.localizedDescription)")
        showLoadError()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("QingSuan WebView provisional failure: \(error.localizedDescription)")
        showLoadError()
    }

    private func showLoadError() {
        let message = NSTextField(labelWithString: "应用资源加载失败，请重新安装或重新构建。")
        message.alignment = .center
        message.translatesAutoresizingMaskIntoConstraints = false
        let view = NSView()
        view.addSubview(message)
        NSLayoutConstraint.activate([
            message.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            message.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        window.contentView = view
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.activate(ignoringOtherApps: true)
application.run()
