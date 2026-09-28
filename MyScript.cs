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
        try{
            Harmony harmony = new Harmony("analyzerun");
            harmony.PatchAll();
            GD.Print("[analyzerun]Mod Initialized");
        }
        catch(Exception e)
        {
            GD.PrintErr($"[analyzerun] Mod initialization failed: {e}");
        }
    }
}

[HarmonyPatch(typeof(NRunHistory), "DisplayRun")]
public static class RunHistoryPostfix
{
    private static readonly string currentModDir;
    private static readonly string HtmlPath;
    private static readonly string DataJsPath;
    private static bool _browserOpened = false;

    static RunHistoryPostfix()
    {
        try
        {
            currentModDir = Path.GetDirectoryName(typeof(RunHistoryPostfix).Assembly.Location);
            HtmlPath = Path.Combine(currentModDir, "index.html");
            DataJsPath = Path.Combine(currentModDir, "analyzerun_history.js");
            
            GD.Print("[analyzerun]Mod parameters Initialized");
        }
        catch (Exception e)
        {
            GD.PrintErr($"[analyzerun] Mod parameters Initialization failed: {e}");

            currentModDir = "";
            HtmlPath = "";
            DataJsPath = "";
        }
    }

    public static void Postfix(object __instance, RunHistory history)
    {
        if(currentModDir=="") return;
        if(HtmlPath=="") return;
        if(DataJsPath=="") return;
        try
        {
            GD.Print("[analyzerun] dump process");
            var options = new JsonSerializerOptions {WriteIndented = true};
            string jsonString = JsonSerializer.Serialize(history, options);
            string jsString = "rundata = " + jsonString + ";";
            System.IO.File.WriteAllText(DataJsPath, jsString);
            GD.Print("[analyzerun] ==> dumped run history");

            GD.Print("[analyzerun] open process");
            if (!_browserOpened)
            {
                Process.Start(new ProcessStartInfo(HtmlPath){ UseShellExecute = true });
                _browserOpened = true;
                GD.Print("[analyzerun] ==> opened browser");
            }
        }
        catch (Exception e)
        {
            GD.PrintErr($"[analyzerun] failed to dump: {e}");
        }
    }
}