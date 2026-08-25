using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace DualCodexDay.Profiles
{
    internal sealed class ProfilePaths
    {
        public string root { get; set; }
        public string codexHome { get; set; }
    }

    internal sealed class Profile
    {
        public string id { get; set; }
        public string name { get; set; }
        public ProfilePaths paths { get; set; }
        public override string ToString() { return name; }
    }

    internal sealed class ProfileListResponse
    {
        public Profile[] profiles { get; set; }
    }

    internal sealed class CreateResponse
    {
        public Profile profile { get; set; }
    }

    internal sealed class TargetInfo
    {
        public bool available { get; set; }
    }

    internal sealed class TargetSet
    {
        public TargetInfo cli { get; set; }
        public TargetInfo vscode { get; set; }
        public TargetInfo desktop { get; set; }
    }

    internal sealed class DoctorResponse
    {
        public TargetSet targets { get; set; }
    }

    internal sealed class LauncherForm : Form
    {
        private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();
        private readonly string repositoryRoot;
        private readonly string cliPath;
        private readonly string nodePath;
        private readonly Dictionary<string, object> labels;
        private readonly ListBox profileList = new ListBox();
        private readonly TextBox nameBox = new TextBox();
        private readonly TextBox workspaceBox = new TextBox();
        private readonly Label statusLabel = new Label();
        private readonly Button desktopButton = new Button();
        private readonly ToolTip toolTip = new ToolTip();

        internal LauncherForm()
        {
            repositoryRoot = Directory.GetParent(AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar)).FullName;
            cliPath = Path.Combine(repositoryRoot, "scripts", "codex-profiles.mjs");
            nodePath = FindExecutable("node.exe");
            if (nodePath == null) throw new InvalidOperationException("Node.js 22.5 or newer is required.");
            labels = serializer.Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(repositoryRoot, "config", "profiles.zh-CN.json"), Encoding.UTF8));

            Text = L("title");
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(760, 540);
            MinimumSize = new Size(776, 579);
            Font = new Font("Microsoft YaHei UI", 9F);
            AutoScaleMode = AutoScaleMode.Dpi;
            var iconPath = Path.Combine(repositoryRoot, "assets", "codex-day.ico");
            if (File.Exists(iconPath)) Icon = new Icon(iconPath);

            var title = LabelAt(L("title"), 24, 20, 700, 36);
            title.Font = new Font("Microsoft YaHei UI", 17F, FontStyle.Bold);
            Controls.Add(title);

            var subtitle = LabelAt(L("subtitle"), 27, 59, 700, 24);
            subtitle.ForeColor = Color.FromArgb(80, 86, 94);
            Controls.Add(subtitle);

            var group = new GroupBox { Text = L("profiles"), Location = new Point(24, 92), Size = new Size(712, 242), Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right };
            Controls.Add(group);

            profileList.Location = new Point(16, 28);
            profileList.Size = new Size(680, 142);
            profileList.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            profileList.DoubleClick += delegate { LaunchSelected("vscode", "VS Code"); };
            group.Controls.Add(profileList);

            nameBox.Location = new Point(16, 190);
            nameBox.Size = new Size(430, 28);
            nameBox.Anchor = AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
            nameBox.KeyDown += delegate(object sender, KeyEventArgs args) { if (args.KeyCode == Keys.Enter) CreateProfile(); };
            group.Controls.Add(nameBox);

            var createButton = ButtonAt(L("create"), 462, 188, 234, 32);
            createButton.Anchor = AnchorStyles.Bottom | AnchorStyles.Right;
            createButton.Click += delegate { CreateProfile(); };
            group.Controls.Add(createButton);

            Controls.Add(LabelAt(L("workspace"), 27, 352, 180, 22));
            workspaceBox.Text = repositoryRoot;
            workspaceBox.Location = new Point(24, 376);
            workspaceBox.Size = new Size(585, 28);
            workspaceBox.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            Controls.Add(workspaceBox);

            var browseButton = ButtonAt(L("browse"), 621, 374, 115, 32);
            browseButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            browseButton.Click += delegate { BrowseWorkspace(); };
            Controls.Add(browseButton);

            var cliButton = ButtonAt(L("launchCli"), 24, 424, 150, 38);
            cliButton.Click += delegate { LaunchSelected("cli", "CLI"); };
            Controls.Add(cliButton);

            var vscodeButton = ButtonAt(L("launchVscode"), 184, 424, 165, 38);
            vscodeButton.Click += delegate { LaunchSelected("vscode", "VS Code"); };
            Controls.Add(vscodeButton);

            desktopButton.Text = L("launchDesktop");
            desktopButton.Location = new Point(359, 424);
            desktopButton.Size = new Size(228, 38);
            desktopButton.Click += delegate { LaunchSelected("desktop", L("launchDesktop")); };
            Controls.Add(desktopButton);

            var folderButton = ButtonAt(L("openFolder"), 597, 424, 139, 38);
            folderButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            folderButton.Click += delegate { OpenSelectedFolder(); };
            Controls.Add(folderButton);

            statusLabel.Text = L("ready");
            statusLabel.Location = new Point(27, 478);
            statusLabel.Size = new Size(700, 22);
            statusLabel.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Bottom;
            Controls.Add(statusLabel);

            var privacy = LabelAt(L("privacy"), 27, 505, 700, 22);
            privacy.ForeColor = Color.FromArgb(80, 86, 94);
            privacy.Anchor = AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Bottom;
            Controls.Add(privacy);

            var doctor = RunCore<DoctorResponse>(new[] { "doctor", "--json" });
            desktopButton.Enabled = doctor.targets != null && doctor.targets.desktop != null && doctor.targets.desktop.available;
            toolTip.SetToolTip(desktopButton, desktopButton.Enabled ? L("desktopWarning") : L("desktopUnavailable"));

            Shown += delegate { RefreshProfiles(null); };
        }

        private string L(string key)
        {
            object value;
            return labels.TryGetValue(key, out value) ? Convert.ToString(value) : key;
        }

        private static Label LabelAt(string text, int x, int y, int width, int height)
        {
            return new Label { Text = text, Location = new Point(x, y), Size = new Size(width, height) };
        }

        private static Button ButtonAt(string text, int x, int y, int width, int height)
        {
            return new Button { Text = text, Location = new Point(x, y), Size = new Size(width, height) };
        }

        private static string FindExecutable(string name)
        {
            var pathValue = Environment.GetEnvironmentVariable("PATH") ?? String.Empty;
            foreach (var directory in pathValue.Split(Path.PathSeparator))
            {
                try
                {
                    var candidate = Path.Combine(directory.Trim('"'), name);
                    if (File.Exists(candidate)) return candidate;
                }
                catch { }
            }
            return null;
        }

        private static string Quote(string value)
        {
            if (String.IsNullOrEmpty(value)) return "\"\"";
            if (value.IndexOfAny(new[] { ' ', '\t', '\n', '\v', '"' }) < 0) return value;
            var builder = new StringBuilder("\"");
            var backslashes = 0;
            foreach (var character in value)
            {
                if (character == '\\') { backslashes++; continue; }
                if (character == '"') builder.Append('\\', backslashes * 2 + 1).Append('"');
                else { builder.Append('\\', backslashes).Append(character); }
                backslashes = 0;
            }
            builder.Append('\\', backslashes * 2).Append('"');
            return builder.ToString();
        }

        private T RunCore<T>(IEnumerable<string> arguments)
        {
            var command = new StringBuilder(Quote(cliPath));
            foreach (var argument in arguments) command.Append(' ').Append(Quote(argument));
            var startInfo = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = command.ToString(),
                WorkingDirectory = repositoryRoot,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };
            using (var process = Process.Start(startInfo))
            {
                var output = process.StandardOutput.ReadToEnd();
                var error = process.StandardError.ReadToEnd();
                process.WaitForExit();
                if (process.ExitCode != 0) throw new InvalidOperationException(String.IsNullOrWhiteSpace(error) ? output.Trim() : error.Trim());
                return serializer.Deserialize<T>(output);
            }
        }

        private void RefreshProfiles(string selectedId)
        {
            try
            {
                var payload = RunCore<ProfileListResponse>(new[] { "list", "--json" });
                profileList.Items.Clear();
                var selectedIndex = -1;
                var profiles = payload.profiles ?? new Profile[0];
                for (var index = 0; index < profiles.Length; index++)
                {
                    profileList.Items.Add(profiles[index]);
                    if (profiles[index].id == selectedId) selectedIndex = index;
                }
                profileList.SelectedIndex = selectedIndex >= 0 ? selectedIndex : (profileList.Items.Count > 0 ? 0 : -1);
                if (profileList.Items.Count == 0) SetStatus(L("empty"), false);
            }
            catch (Exception error) { SetStatus(String.Format(L("failed"), error.Message), true); }
        }

        private Profile SelectedProfile()
        {
            var profile = profileList.SelectedItem as Profile;
            if (profile == null) SetStatus(L("selectProfile"), true);
            return profile;
        }

        private void CreateProfile()
        {
            try
            {
                var result = RunCore<CreateResponse>(new[] { "create", nameBox.Text, "--json" });
                nameBox.Clear();
                RefreshProfiles(result.profile.id);
                SetStatus(String.Format(L("created"), result.profile.name), false);
            }
            catch (Exception error) { SetStatus(String.Format(L("failed"), error.Message), true); }
        }

        private void LaunchSelected(string target, string targetLabel)
        {
            var profile = SelectedProfile();
            if (profile == null) return;
            try
            {
                RunCore<Dictionary<string, object>>(new[] { "launch", profile.id, "--target", target, "--workspace", Path.GetFullPath(workspaceBox.Text), "--json" });
                SetStatus(String.Format(L("launched"), profile.name, targetLabel), false);
            }
            catch (Exception error) { SetStatus(String.Format(L("failed"), error.Message), true); }
        }

        private void BrowseWorkspace()
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = L("selectWorkspace");
                dialog.SelectedPath = workspaceBox.Text;
                if (dialog.ShowDialog(this) == DialogResult.OK) workspaceBox.Text = dialog.SelectedPath;
            }
        }

        private void OpenSelectedFolder()
        {
            var profile = SelectedProfile();
            if (profile == null) return;
            Process.Start(new ProcessStartInfo("explorer.exe", Quote(profile.paths.root)) { UseShellExecute = true });
        }

        private void SetStatus(string text, bool failed)
        {
            statusLabel.Text = text;
            statusLabel.ForeColor = failed ? Color.Firebrick : Color.FromArgb(35, 92, 63);
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            try { Application.Run(new LauncherForm()); }
            catch (Exception error) { MessageBox.Show(error.Message, "Dual Codex Day", MessageBoxButtons.OK, MessageBoxIcon.Error); }
        }
    }
}
