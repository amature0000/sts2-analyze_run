using Godot;
using HarmonyLib;
using MegaCrit.Sts2.Core.Modding;
using MegaCrit.Sts2.Core.Nodes.Screens.RunHistoryScreen;
using MegaCrit.Sts2.Core.Runs;
using System;
using System.Text.Json;
using System.Diagnostics;
using System.IO;

[ModInitializer("ModInit")]
public static class ModStart
{
    public static void ModInit()
    {
		Harmony harmony = new Harmony("sharerun");
        harmony.PatchAll();
        GD.Print("[sharerun]Mod Initialized");
    }
}

[HarmonyPatch(typeof(NRunHistory), "DisplayRun")]
public static class RunHistoryPostfix
{
    private static readonly string ModFolderPath;
    private static readonly string HtmlPath;
    private static readonly string DataJsPath;
    private static bool _browserOpened = false;

    static RunHistoryPostfix()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string rootDir = Directory.GetParent(baseDir).Parent.FullName;
        
        ModFolderPath = Path.Combine(rootDir, "mods", "sharerun");
        HtmlPath = Path.Combine(ModFolderPath, "index.html");
        DataJsPath = Path.Combine(ModFolderPath, "sharerun_history.js");
    }

    public static void Postfix(object __instance, RunHistory history)
    {
        try
        {
            if (history.MapPointHistory == null) return;

            GD.Print("[sharerun] starting process");
            string jsonString = JsonSerializer.Serialize(history);
            string jsString = $"rundata = {jsonString};";
            System.IO.File.WriteAllText(DataJsPath, jsString);
            GD.Print("[sharerun] ==> dumped run history");

            GD.Print("[sharerun] ==> opening browser");
            if (!_browserOpened)
            {
                Process.Start(new ProcessStartInfo(HtmlPath){ UseShellExecute = true });
                _browserOpened = true;
                GD.Print("[sharerun] == ==> opened browser");
            }
        }
        catch (Exception e)
        {
            GD.PrintErr($"[sharerun] failed to dump: {e.Message}");
        }
        GD.Print("[sharerun] end process");
    }
}