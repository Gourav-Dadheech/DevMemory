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

            // 2. Check if port 5005 is already active
            bool isRunning = IsPortActive(5005);

            if (!isRunning)
            {
                // Start Node server in background
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "cmd.exe";
                    psi.Arguments = "/c start \"\" /b node \"" + serverScript + "\"";
                    psi.WorkingDirectory = serverDir;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = true;

                    Process.Start(psi);

                    // Wait up to 2 seconds for server to start
                    for (int i = 0; i < 20; i++)
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
            }

            // 3. Open browser to dashboard
            try
            {
                Process.Start(new ProcessStartInfo("http://localhost:5005/dashboard") { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not open browser to http://localhost:5005/dashboard:\n" + ex.Message, "DevMemory Warning", MessageBoxButtons.OK, MessageBoxIcon.Warning);
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
    }
}
