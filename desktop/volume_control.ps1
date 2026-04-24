$AudioDefinition = @"
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int f1(); int f2(); int f3(); int f4();
    int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
    int f5();
    int GetMasterVolumeLevelScalar(out float pfLevel);
}

[Guid("D6660639-8487-4E4F-BDD2-53E363900062"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    int Activate(ref Guid id, int clsCtx, IntPtr activationParams, out IAudioEndpointVolume aev);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    int f1();
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator { }

public class AudioControl {
    public static float Get() {
        try {
            var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
            IMMDevice dev;
            // eRender = 0, eConsole = 0
            enumerator.GetDefaultAudioEndpoint(0, 0, out dev);
            IAudioEndpointVolume epv;
            var id = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
            dev.Activate(ref id, 1, IntPtr.Zero, out epv);
            float v;
            epv.GetMasterVolumeLevelScalar(out v);
            return v;
        } catch { return -1.0f; }
    }
    public static void Set(float v) {
        try {
            var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
            IMMDevice dev;
            enumerator.GetDefaultAudioEndpoint(0, 0, out dev);
            IAudioEndpointVolume epv;
            var id = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
            dev.Activate(ref id, 1, IntPtr.Zero, out epv);
            epv.SetMasterVolumeLevelScalar(v, Guid.Empty);
        } catch { }
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'AudioControl').Type) {
    Add-Type -TypeDefinition $AudioDefinition -ErrorAction SilentlyContinue
}

if ($args.Count -eq 0) {
    [AudioControl]::Get()
} else {
    [AudioControl]::Set([float]$args[0])
}
