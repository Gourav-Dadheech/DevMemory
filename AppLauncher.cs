using System;
using System.IO;
using System.Diagnostics;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace DevMemory
{
    static class AppLauncher
    {
        [STAThread]
        static void Main()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string serverDir = Path.Combine(appDir, "server");
            string serverScript = Path.Combine(serverDir, "server.js");

            // 1. Check if Node.js is installed
            if (!IsNodeInstalled())
            {
                DialogResult res = MessageBox.Show(
                    "Node.js is required to run DevMemory locally.\n\n" +
                    "DevMemory runs 100% on your machine for zero cost and complete privacy.\n\n" +
                    "Would you like to open nodejs.org to download Node.js now?",
                    "DevMemory - Node.js Required",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Information);

                if (res == DialogResult.Yes)
                {
                    Process.Start(new ProcessStartInfo("https://nodejs.org/en/download") { UseShellExecute = true });
                }
                return;
            }

            // 2. Automatically clear any lingering zombie processes on port 5005
            FreePort(5005);
            Thread.Sleep(200);

            // 3. Start Node server in background
            Process serverProc = null;
            try
            {
                ProcessStartInfo serverPsi = new ProcessStartInfo();
                serverPsi.FileName = "node";
                serverPsi.Arguments = "\"" + serverScript + "\"";
                serverPsi.WorkingDirectory = serverDir;
                serverPsi.CreateNoWindow = true;
                serverPsi.WindowStyle = ProcessWindowStyle.Hidden;
                serverPsi.UseShellExecute = false;

                serverProc = Process.Start(serverPsi);

                // Wait up to 3 seconds for server to listen on port 5005
                for (int i = 0; i < 30; i++)
                {
                    Thread.Sleep(100);
                    if (IsPortActive(5005)) break;
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to launch DevMemory backend server:\n" + ex.Message, "DevMemory Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // 4. Launch in Native Standalone App Window (No browser tabs, no address bar)
            string browserPath = FindAppBrowser();
            string profileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"DevMemory\profile");

            try
            {
                Directory.CreateDirectory(profileDir);
            }
            catch {}

            if (!string.IsNullOrEmpty(browserPath))
            {
                try
                {
                    ProcessStartInfo appPsi = new ProcessStartInfo();
                    appPsi.FileName = browserPath;
                    appPsi.Arguments = "--app=\"http://localhost:5005/dashboard\" --user-data-dir=\"" + profileDir + "\" --window-size=1360,860";
                    appPsi.UseShellExecute = true;

                    Process appProc = Process.Start(appPsi);

                    // If we can track the app window, shut down the server when the user closes the app
                    if (appProc != null && serverProc != null && !serverProc.HasExited)
                    {
                        appProc.WaitForExit();
                        try
                        {
                            if (!serverProc.HasExited) serverProc.Kill();
                        }
                        catch {}
                    }
                }
                catch
                {
                    // Fallback to default browser
                    Process.Start(new ProcessStartInfo("http://localhost:5005/dashboard") { UseShellExecute = true });
                }
            }
            else
            {
                // Fallback to default browser
                Process.Start(new ProcessStartInfo("http://localhost:5005/dashboard") { UseShellExecute = true });
            }
        }

        static bool IsNodeInstalled()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("node", "--version");
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = true;
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit(3000);
                    return p.ExitCode == 0;
                }
            }
            catch
            {
                return false;
            }
        }

        static void FreePort(int port)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = "/c \"for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :" + port + "') do taskkill /f /pid %a\"";
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.UseShellExecute = false;
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit(1500);
                }
            }
            catch {}
        }

        static bool IsPortActive(int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    var result = client.BeginConnect("127.0.0.1", port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(300);
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        static string FindAppBrowser()
        {
            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string p in candidates)
            {
                if (File.Exists(p)) return p;
            }

            return null;
        }
    }
}
