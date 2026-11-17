using System;
using System.IO;
using System.IO.Compression;
using System.Drawing;
using System.Windows.Forms;
using System.Diagnostics;
using System.Reflection;

namespace DevMemoryInstaller
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }

    public class InstallerForm : Form
    {
        private Label lblTitle;
        private Label lblSubtitle;
        private Label lblPathHeader;
        private TextBox txtPath;
        private Button btnBrowse;
        private CheckBox chkDesktop;
        private CheckBox chkStartMenu;
        private CheckBox chkLaunch;
        private Button btnInstall;
        private Label lblStatus;
        private ProgressBar progressBar;

        public InstallerForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "DevMemory Setup Wizard";
            this.Size = new Size(520, 440);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(10, 10, 10);
            this.ForeColor = Color.FromArgb(240, 240, 240);
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular);

            // Try loading embedded icon
            try
            {
                using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("DevMemory.ico"))
                {
                    if (s != null) this.Icon = new Icon(s);
                }
            }
            catch {}

            // Header Banner
            Panel pnlHeader = new Panel();
            pnlHeader.Dock = DockStyle.Top;
            pnlHeader.Height = 85;
            pnlHeader.BackColor = Color.FromArgb(18, 18, 18);
            pnlHeader.Paint += (s, e) => {
                using (Pen pen = new Pen(Color.FromArgb(40, 40, 40))) {
                    e.Graphics.DrawLine(pen, 0, pnlHeader.Height - 1, pnlHeader.Width, pnlHeader.Height - 1);
                }
            };

            lblTitle = new Label();
            lblTitle.Text = "DevMemory Setup";
            lblTitle.Font = new Font("Segoe UI", 16F, FontStyle.Bold);
            lblTitle.ForeColor = Color.White;
            lblTitle.AutoSize = true;
            lblTitle.Location = new Point(24, 16);

            lblSubtitle = new Label();
            lblSubtitle.Text = "Install the Living AI Project Brain on your personal PC";
            lblSubtitle.Font = new Font("Segoe UI", 8.5F, FontStyle.Regular);
            lblSubtitle.ForeColor = Color.FromArgb(160, 160, 160);
            lblSubtitle.AutoSize = true;
            lblSubtitle.Location = new Point(26, 48);

            pnlHeader.Controls.Add(lblTitle);
            pnlHeader.Controls.Add(lblSubtitle);
            this.Controls.Add(pnlHeader);

            // Destination Path Label
            lblPathHeader = new Label();
            lblPathHeader.Text = "Installation Folder:";
            lblPathHeader.Location = new Point(26, 102);
            lblPathHeader.AutoSize = true;
            lblPathHeader.ForeColor = Color.FromArgb(210, 210, 210);
            this.Controls.Add(lblPathHeader);

            string defaultPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\DevMemory");
            txtPath = new TextBox();
            txtPath.Text = defaultPath;
            txtPath.Location = new Point(28, 126);
            txtPath.Size = new Size(350, 25);
            txtPath.BackColor = Color.FromArgb(24, 24, 24);
            txtPath.ForeColor = Color.White;
            txtPath.BorderStyle = BorderStyle.FixedSingle;
            this.Controls.Add(txtPath);

            btnBrowse = new Button();
            btnBrowse.Text = "Browse...";
            btnBrowse.Location = new Point(386, 124);
            btnBrowse.Size = new Size(88, 27);
            btnBrowse.BackColor = Color.FromArgb(32, 32, 32);
            btnBrowse.ForeColor = Color.White;
            btnBrowse.FlatStyle = FlatStyle.Flat;
            btnBrowse.FlatAppearance.BorderColor = Color.FromArgb(60, 60, 60);
            btnBrowse.Cursor = Cursors.Hand;
            btnBrowse.Click += (s, e) => {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.SelectedPath = txtPath.Text;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        txtPath.Text = fbd.SelectedPath;
                    }
                }
            };
            this.Controls.Add(btnBrowse);

            // Options Checkboxes
            chkDesktop = new CheckBox();
            chkDesktop.Text = "Create Desktop Shortcut (with official DevMemory logo)";
            chkDesktop.Checked = true;
            chkDesktop.Location = new Point(28, 168);
            chkDesktop.AutoSize = true;
            chkDesktop.ForeColor = Color.FromArgb(230, 230, 230);
            this.Controls.Add(chkDesktop);

            chkStartMenu = new CheckBox();
            chkStartMenu.Text = "Create Start Menu Shortcut";
            chkStartMenu.Checked = true;
            chkStartMenu.Location = new Point(28, 198);
            chkStartMenu.AutoSize = true;
            chkStartMenu.ForeColor = Color.FromArgb(230, 230, 230);
            this.Controls.Add(chkStartMenu);

            chkLaunch = new CheckBox();
            chkLaunch.Text = "Launch DevMemory immediately after installation";
            chkLaunch.Checked = true;
            chkLaunch.Location = new Point(28, 228);
            chkLaunch.AutoSize = true;
            chkLaunch.ForeColor = Color.FromArgb(230, 230, 230);
            this.Controls.Add(chkLaunch);

            // Progress Bar
            progressBar = new ProgressBar();
            progressBar.Location = new Point(28, 270);
            progressBar.Size = new Size(446, 12);
            progressBar.Visible = false;
            this.Controls.Add(progressBar);

            // Status Label
            lblStatus = new Label();
            lblStatus.Text = "Ready to install. Click 'Install DevMemory' to proceed.";
            lblStatus.Location = new Point(28, 292);
            lblStatus.AutoSize = true;
            lblStatus.ForeColor = Color.FromArgb(140, 140, 140);
            this.Controls.Add(lblStatus);

            // Install Button
            btnInstall = new Button();
            btnInstall.Text = "Install DevMemory";
            btnInstall.Font = new Font("Segoe UI", 10F, FontStyle.Bold);
            btnInstall.Location = new Point(28, 328);
            btnInstall.Size = new Size(446, 42);
            btnInstall.BackColor = Color.White;
            btnInstall.ForeColor = Color.Black;
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.FlatAppearance.BorderSize = 0;
            btnInstall.Cursor = Cursors.Hand;
            btnInstall.Click += new EventHandler(BtnInstall_Click);
            this.Controls.Add(btnInstall);
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            btnInstall.Enabled = false;
            btnBrowse.Enabled = false;
            txtPath.ReadOnly = true;
            progressBar.Visible = true;
            progressBar.Style = ProgressBarStyle.Marquee;
            lblStatus.Text = "Unpacking DevMemory files...";
            lblStatus.ForeColor = Color.FromArgb(220, 220, 220);

            string targetDir = txtPath.Text.Trim();
            if (string.IsNullOrEmpty(targetDir))
            {
                targetDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\DevMemory");
            }

            try
            {
                Directory.CreateDirectory(targetDir);

                // 1. Extract embedded zip resource
                Assembly asm = Assembly.GetExecutingAssembly();
                string zipResourceName = null;
                foreach (string res in asm.GetManifestResourceNames())
                {
                    if (res.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                    {
                        zipResourceName = res;
                        break;
                    }
                }

                if (zipResourceName != null)
                {
                    using (Stream zipStream = asm.GetManifestResourceStream(zipResourceName))
                    using (ZipArchive archive = new ZipArchive(zipStream))
                    {
                        foreach (ZipArchiveEntry entry in archive.Entries)
                        {
                            string destPath = Path.Combine(targetDir, entry.FullName);
                            if (string.IsNullOrEmpty(entry.Name))
                            {
                                Directory.CreateDirectory(destPath);
                            }
                            else
                            {
                                Directory.CreateDirectory(Path.GetDirectoryName(destPath));
                                entry.ExtractToFile(destPath, true);
                            }
                        }
                    }
                }
                else
                {
                    throw new Exception("Embedded package resource not found.");
                }

                // 2. Ensure icon file exists in target dir
                string iconPath = Path.Combine(targetDir, "DevMemory.ico");
                if (!File.Exists(iconPath))
                {
                    string icoRes = null;
                    foreach (string res in asm.GetManifestResourceNames())
                    {
                        if (res.EndsWith(".ico", StringComparison.OrdinalIgnoreCase)) { icoRes = res; break; }
                    }
                    if (icoRes != null)
                    {
                        using (Stream isrc = asm.GetManifestResourceStream(icoRes))
                        using (FileStream idst = new FileStream(iconPath, FileMode.Create))
                        {
                            isrc.CopyTo(idst);
                        }
                    }
                }

                // 3. Executable path
                string exePath = Path.Combine(targetDir, "DevMemory.exe");
                if (!File.Exists(exePath))
                {
                    // Fallback to start.bat if exe is missing
                    exePath = Path.Combine(targetDir, "start.bat");
                }

                // 4. Create Desktop Shortcut with official icon
                if (chkDesktop.Checked)
                {
                    string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                    string shortcutPath = Path.Combine(desktopPath, "DevMemory.lnk");
                    CreateShortcut(shortcutPath, exePath, targetDir, iconPath, "DevMemory - Living Project Brain & Architecture Visualizer");
                }

                // 5. Create Start Menu Shortcut
                if (chkStartMenu.Checked)
                {
                    string programsPath = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                    string shortcutPath = Path.Combine(programsPath, "DevMemory.lnk");
                    CreateShortcut(shortcutPath, exePath, targetDir, iconPath, "DevMemory - Living Project Brain & Architecture Visualizer");
                }

                // 6. Create Uninstaller script
                string uninstallerPath = Path.Combine(targetDir, "Uninstall-DevMemory.bat");
                string uninstallerScript = "@echo off\r\n" +
                    "echo Uninstalling DevMemory...\r\n" +
                    "del /q \"" + Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "DevMemory.lnk") + "\" 2>nul\r\n" +
                    "del /q \"" + Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "DevMemory.lnk") + "\" 2>nul\r\n" +
                    "cd /d \"%TEMP%\"\r\n" +
                    "echo DevMemory shortcuts removed.\r\n" +
                    "echo You can now delete the directory: " + targetDir + "\r\n" +
                    "pause\r\n";
                File.WriteAllText(uninstallerPath, uninstallerScript);

                // Setup finished successfully
                progressBar.Style = ProgressBarStyle.Continuous;
                progressBar.Value = 100;
                lblStatus.Text = "Installation complete! Desktop shortcut created.";
                lblStatus.ForeColor = Color.FromArgb(120, 255, 120);

                // 7. Launch if requested
                if (chkLaunch.Checked && File.Exists(exePath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = exePath;
                    psi.WorkingDirectory = targetDir;
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                }

                MessageBox.Show(
                    "DevMemory has been successfully installed!\n\n" +
                    "An official DevMemory shortcut has been placed on your Desktop.\n" +
                    "Double-click it anytime to launch your local project brain.",
                    "DevMemory Setup Complete",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);

                this.Close();
            }
            catch (Exception ex)
            {
                progressBar.Visible = false;
                btnInstall.Enabled = true;
                btnBrowse.Enabled = true;
                txtPath.ReadOnly = false;
                lblStatus.Text = "Error: " + ex.Message;
                lblStatus.ForeColor = Color.FromArgb(255, 100, 100);
                MessageBox.Show("Installation failed:\n" + ex.Message, "Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void CreateShortcut(string shortcutPath, string targetPath, string workingDirectory, string iconPath, string description)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return;
                dynamic shell = Activator.CreateInstance(shellType);
                dynamic shortcut = shell.CreateShortcut(shortcutPath);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = workingDirectory;
                shortcut.WindowStyle = 1;
                shortcut.Description = description;
                if (File.Exists(iconPath))
                {
                    shortcut.IconLocation = iconPath + ",0";
                }
                shortcut.Save();
            }
            catch {}
        }
    }
}
