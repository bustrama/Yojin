import Foundation

/// Manages the Yojin Node.js server process and monitors its health.
final class ServerManager {
    enum Status: Equatable { case stopped, starting, running }

    private(set) var status: Status = .stopped
    private var process: Process?
    private var healthTimer: Timer?
    private var port: Int = 3000
    private let onStatusChange: (Status) -> Void

    init(onStatusChange: @escaping (Status) -> Void) {
        self.onStatusChange = onStatusChange
    }

    // MARK: - Start / Stop

    func start() {
        guard status == .stopped else { return }

        guard let binaryPath = findYojinBinary() else {
            NSLog("[YojinTray] Could not find 'yojin' binary in PATH")
            return
        }

        NSLog("[YojinTray] Starting server: %@", binaryPath)
        setStatus(.starting)

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/bin/zsh")
        proc.arguments = ["-l", "-c", "\(binaryPath) start"]
        proc.standardOutput = logFileHandle()
        proc.standardError = logFileHandle()
        proc.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async { self?.handleTermination() }
        }

        do {
            try proc.run()
            process = proc
            startHealthPolling()
        } catch {
            NSLog("[YojinTray] Failed to start: %@", error.localizedDescription)
            setStatus(.stopped)
        }
    }

    func stop() {
        guard let proc = process, proc.isRunning else { return }
        NSLog("[YojinTray] Stopping server (SIGTERM)")
        stopHealthPolling()
        proc.terminate() // sends SIGTERM — Yojin handles graceful shutdown
    }

    var isRunning: Bool { status == .running }

    // MARK: - Binary Discovery

    /// Finds the `yojin` binary by invoking a login shell so NVM/fnm paths are available.
    private func findYojinBinary() -> String? {
        let proc = Process()
        let pipe = Pipe()
        proc.executableURL = URL(fileURLWithPath: "/bin/zsh")
        proc.arguments = ["-l", "-c", "which yojin"]
        proc.standardOutput = pipe
        proc.standardError = FileHandle.nullDevice

        do {
            try proc.run()
            proc.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let path = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
            if let path, !path.isEmpty, FileManager.default.fileExists(atPath: path) {
                return path
            }
        } catch {}

        // Fallback: check common locations
        let candidates = [
            "\(NSHomeDirectory())/.nvm/versions/node/v22.22.1/bin/yojin",
            "/usr/local/bin/yojin",
            "/opt/homebrew/bin/yojin",
        ]
        return candidates.first { FileManager.default.fileExists(atPath: $0) }
    }

    // MARK: - Health Polling

    private func startHealthPolling() {
        stopHealthPolling()
        healthTimer = Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
            self?.checkHealth()
        }
    }

    private func stopHealthPolling() {
        healthTimer?.invalidate()
        healthTimer = nil
    }

    private func checkHealth() {
        guard let url = URL(string: "http://127.0.0.1:\(port)/health") else { return }

        let task = URLSession.shared.dataTask(with: url) { [weak self] _, response, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                    if self.status != .running { self.setStatus(.running) }
                } else if self.status == .running {
                    // Server was running but health check failed — might be shutting down
                    self.setStatus(.starting)
                }
            }
        }
        task.resume()
    }

    // MARK: - Logging

    private func logFileHandle() -> FileHandle {
        let logDir = "\(NSHomeDirectory())/.yojin/logs"
        try? FileManager.default.createDirectory(atPath: logDir, withIntermediateDirectories: true)
        let logPath = "\(logDir)/tray.log"
        if !FileManager.default.fileExists(atPath: logPath) {
            FileManager.default.createFile(atPath: logPath, contents: nil)
        }
        return FileHandle(forWritingAtPath: logPath) ?? .nullDevice
    }

    // MARK: - Internal

    private func handleTermination() {
        NSLog("[YojinTray] Server process terminated")
        process = nil
        stopHealthPolling()
        setStatus(.stopped)
    }

    private func setStatus(_ newStatus: Status) {
        guard status != newStatus else { return }
        status = newStatus
        onStatusChange(newStatus)
    }
}
