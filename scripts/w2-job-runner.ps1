param(
  [Parameter(Mandatory = $true)]
  [string]$PayloadBase64
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

try {
  $payloadJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64))
  $payload = ConvertFrom-Json -InputObject $payloadJson

  $source = @'
using System;
using System.ComponentModel;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.IO;

namespace W2 {
  public sealed class JobSetupException : Exception {
    public JobSetupException(string message) : base(message) { }
  }

  public static class JobRunner {
    private const uint CreateBreakawayFromJob = 0x01000000;
    private const uint CreateNoWindow = 0x08000000;
    private const uint CreateUnicodeEnvironment = 0x00000400;
    private const uint StartfUseStdHandles = 0x00000100;
    private const uint JobObjectExtendedLimitInformation = 9;
    private const uint JobObjectLimitKillOnJobClose = 0x00002000;

    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfo {
      public uint cb;
      public IntPtr reserved;
      public IntPtr desktop;
      public IntPtr title;
      public uint x;
      public uint y;
      public uint xSize;
      public uint ySize;
      public uint xCountChars;
      public uint yCountChars;
      public uint fillAttribute;
      public uint flags;
      public ushort showWindow;
      public ushort reserved2Size;
      public IntPtr reserved2;
      public IntPtr stdInput;
      public IntPtr stdOutput;
      public IntPtr stdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation {
      public IntPtr process;
      public IntPtr thread;
      public uint processId;
      public uint threadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BasicLimitInformation {
      public long perProcessUserTimeLimit;
      public long perJobUserTimeLimit;
      public uint limitFlags;
      public UIntPtr minimumWorkingSetSize;
      public UIntPtr maximumWorkingSetSize;
      public uint activeProcessLimit;
      public UIntPtr affinity;
      public uint priorityClass;
      public uint schedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IoCounters {
      public ulong readOperationCount;
      public ulong writeOperationCount;
      public ulong otherOperationCount;
      public ulong readTransferCount;
      public ulong writeTransferCount;
      public ulong otherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ExtendedLimitInformation {
      public BasicLimitInformation basicLimitInformation;
      public IoCounters ioInfo;
      public UIntPtr processMemoryLimit;
      public UIntPtr jobMemoryLimit;
      public UIntPtr peakProcessMemoryUsed;
      public UIntPtr peakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObjectW(IntPtr jobAttributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetInformationJobObject(IntPtr job, uint informationClass, IntPtr information, uint informationLength);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreateProcessW(string applicationName, StringBuilder commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint creationFlags, IntPtr environment, string currentDirectory, ref StartupInfo startupInfo, out ProcessInformation processInformation);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint SearchPathW(string path, string fileName, string extension, uint bufferLength, StringBuilder buffer, out IntPtr filePart);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool TerminateProcess(IntPtr process, uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int standardHandle);

    public static int Run(string nodeExecutable, string bootstrapPath, string payloadBase64, string currentDirectory, string[] environment, long deadlineEpochMs, out bool timedOut) {
      timedOut = false;
      IntPtr job = CreateJobObjectW(IntPtr.Zero, null);
      if (job == IntPtr.Zero) throw new JobSetupException("CreateJobObjectW failed: " + LastError());

      IntPtr limitBuffer = IntPtr.Zero;
      IntPtr environmentBuffer = IntPtr.Zero;
      ProcessInformation process = new ProcessInformation();
      bool processCreated = false;
      string tempDirectory = Path.Combine(Path.GetTempPath(), "w2-job-" + Guid.NewGuid().ToString("N"));
      string readyPath = Path.Combine(tempDirectory, "ready");
      string gatePath = Path.Combine(tempDirectory, "gate");
      try {
        Directory.CreateDirectory(tempDirectory);
        ExtendedLimitInformation limits = new ExtendedLimitInformation();
        limits.basicLimitInformation.limitFlags = JobObjectLimitKillOnJobClose;
        limitBuffer = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(ExtendedLimitInformation)));
        Marshal.StructureToPtr(limits, limitBuffer, false);
        if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, limitBuffer, (uint)Marshal.SizeOf(typeof(ExtendedLimitInformation)))) {
          throw new JobSetupException("SetInformationJobObject failed: " + LastError());
        }

        string[] sortedEnvironment = (environment ?? new string[0]).OrderBy(entry => entry, StringComparer.OrdinalIgnoreCase).ToArray();
        string environmentBlock = sortedEnvironment.Length == 0 ? "\0\0" : String.Join("\0", sortedEnvironment) + "\0\0";
        environmentBuffer = Marshal.StringToHGlobalUni(environmentBlock);

        StartupInfo startup = new StartupInfo();
        startup.cb = (uint)Marshal.SizeOf(typeof(StartupInfo));
        startup.flags = StartfUseStdHandles;
        startup.stdInput = GetStdHandle(-10);
        startup.stdOutput = GetStdHandle(-11);
        startup.stdError = GetStdHandle(-12);

        string commandLineText = Quote(nodeExecutable) + " " + Quote(bootstrapPath) + " " + Quote(payloadBase64) + " " + Quote(readyPath) + " " + Quote(gatePath);
        StringBuilder commandLine = new StringBuilder(commandLineText);
        string resolvedFile = ResolveExecutable(nodeExecutable);
        uint baseFlags = CreateNoWindow | CreateUnicodeEnvironment;
        if (!CreateProcessW(resolvedFile, commandLine, IntPtr.Zero, IntPtr.Zero, true, baseFlags | CreateBreakawayFromJob, environmentBuffer, currentDirectory, ref startup, out process)) {
          int breakawayError = Marshal.GetLastWin32Error();
          commandLine = new StringBuilder(commandLineText);
          if (!CreateProcessW(resolvedFile, commandLine, IntPtr.Zero, IntPtr.Zero, true, baseFlags, environmentBuffer, currentDirectory, ref startup, out process)) {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateProcessW failed (breakaway attempt: " + breakawayError + ")");
          }
        }
        processCreated = true;

        while (!File.Exists(readyPath)) {
          uint startupWait = WaitForSingleObject(process.process, 10);
          if (startupWait == 0) {
            uint bootstrapExit;
            if (!GetExitCodeProcess(process.process, out bootstrapExit)) throw new Win32Exception(Marshal.GetLastWin32Error(), "GetExitCodeProcess failed before bootstrap readiness");
            return unchecked((int)bootstrapExit);
          }
          if (startupWait != 258) throw new Win32Exception(Marshal.GetLastWin32Error(), "Waiting for bootstrap readiness failed");
          if (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() >= deadlineEpochMs) {
            timedOut = true;
            TerminateProcess(process.process, 124);
            WaitForSingleObject(process.process, 5000);
            return 124;
          }
        }

        if (!AssignProcessToJobObject(job, process.process)) {
          TerminateProcess(process.process, 1);
          WaitForSingleObject(process.process, 5000);
          throw new JobSetupException("AssignProcessToJobObject failed: " + LastError());
        }
        File.WriteAllText(gatePath, "run");

        long remainingMs = deadlineEpochMs - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        uint waitResult = remainingMs <= 0
          ? 258
          : WaitForSingleObject(process.process, (uint)Math.Min(remainingMs, UInt32.MaxValue - 1));
        if (waitResult == 258) {
          timedOut = true;
          if (!TerminateJobObject(job, 124)) throw new Win32Exception(Marshal.GetLastWin32Error(), "Terminating timed-out job failed");
          if (WaitForSingleObject(job, 5000) == 258) throw new Win32Exception("Timed-out job did not terminate within five seconds");
          return 124;
        }
        if (waitResult != 0) throw new Win32Exception(Marshal.GetLastWin32Error(), "Waiting for child process failed");
        uint exitCode;
        if (!GetExitCodeProcess(process.process, out exitCode)) throw new Win32Exception(Marshal.GetLastWin32Error(), "GetExitCodeProcess failed");
        if (!TerminateJobObject(job, exitCode)) throw new Win32Exception(Marshal.GetLastWin32Error(), "Cleaning up remaining job processes failed");
        if (WaitForSingleObject(job, 5000) == 258) throw new Win32Exception("Remaining job processes did not terminate within five seconds");
        return unchecked((int)exitCode);
      } finally {
        CloseHandle(job);
        if (processCreated) {
          if (process.thread != IntPtr.Zero) CloseHandle(process.thread);
          if (process.process != IntPtr.Zero) CloseHandle(process.process);
        }
        if (environmentBuffer != IntPtr.Zero) Marshal.FreeHGlobal(environmentBuffer);
        if (limitBuffer != IntPtr.Zero) Marshal.FreeHGlobal(limitBuffer);
        try { if (Directory.Exists(tempDirectory)) Directory.Delete(tempDirectory, true); } catch { }
      }
    }

    private static string Quote(string value) {
      if (value.Length > 0 && value.All(character => !Char.IsWhiteSpace(character) && character != '"')) return value;
      StringBuilder quoted = new StringBuilder("\"");
      int backslashes = 0;
      foreach (char character in value) {
        if (character == '\\') { backslashes++; continue; }
        if (character == '"') {
          quoted.Append('\\', backslashes * 2 + 1).Append('"');
          backslashes = 0;
          continue;
        }
        quoted.Append('\\', backslashes).Append(character);
        backslashes = 0;
      }
      quoted.Append('\\', backslashes * 2).Append('"');
      return quoted.ToString();
    }

    private static string ResolveExecutable(string file) {
      StringBuilder buffer = new StringBuilder(32768);
      string extension = System.IO.Path.GetExtension(file).Length == 0 ? ".exe" : null;
      IntPtr filePart;
      uint length = SearchPathW(null, file, extension, (uint)buffer.Capacity, buffer, out filePart);
      if (length == 0 || length >= (uint)buffer.Capacity) throw new Win32Exception(Marshal.GetLastWin32Error(), "Resolving executable failed: " + file);
      return buffer.ToString();
    }

    private static string LastError() { return new Win32Exception(Marshal.GetLastWin32Error()).Message; }


    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool TerminateJobObject(IntPtr job, uint exitCode);

  }
}
'@

  $sourceBytes = [Text.Encoding]::UTF8.GetBytes($source)
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try { $sourceHash = [BitConverter]::ToString($sha256.ComputeHash($sourceBytes)).Replace('-', '').ToLowerInvariant() }
  finally { $sha256.Dispose() }
  $cacheRoot = Join-Path ([IO.Path]::GetTempPath()) 'w2-job-runner-cache'
  [IO.Directory]::CreateDirectory($cacheRoot) | Out-Null
  $assemblyPath = Join-Path $cacheRoot "w2-job-runner-$sourceHash.dll"
  $lockPath = Join-Path $cacheRoot "w2-job-runner-$sourceHash.lock"
  if (!(Test-Path -LiteralPath $assemblyPath -PathType Leaf)) {
    $lock = $null
    for ($attempt = 0; $attempt -lt 400 -and !$lock; $attempt++) {
      try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
      catch [IO.IOException] { Start-Sleep -Milliseconds 25 }
    }
    if (!$lock) { throw 'Timed out waiting for the W2 Job Object helper cache lock.' }
    try {
      if (!(Test-Path -LiteralPath $assemblyPath -PathType Leaf)) {
        $temporaryAssembly = Join-Path $cacheRoot "w2-job-runner-$sourceHash-$([guid]::NewGuid().ToString('N')).dll"
        try {
          Add-Type -TypeDefinition $source -OutputAssembly $temporaryAssembly -ErrorAction Stop | Out-Null
          [IO.File]::Move($temporaryAssembly, $assemblyPath)
        }
        finally {
          if (Test-Path -LiteralPath $temporaryAssembly) { Remove-Item -LiteralPath $temporaryAssembly -Force -ErrorAction SilentlyContinue }
        }
      }
    }
    finally { $lock.Dispose() }
  }
  [Reflection.Assembly]::LoadFrom($assemblyPath) | Out-Null
  $environment = @($payload.environment | ForEach-Object { [string]$_ })
  $timedOut = $false
  $deadlineEpochMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + [long]$payload.timeoutMs
  $exitCode = [W2.JobRunner]::Run([string]$payload.nodeExecutable, [string]$payload.bootstrapPath, $PayloadBase64, [string]$payload.cwd, $environment, $deadlineEpochMs, [ref]$timedOut)
  if ($timedOut) { [Console]::Error.WriteLine("W2_JOB_TIMED_OUT") }
  exit $exitCode
} catch {
  [Console]::Error.WriteLine($_.Exception.ToString())
  if ($_.Exception.GetType().FullName -eq "W2.JobSetupException") {
    [Console]::Error.WriteLine("W2_JOB_SETUP_FAILED")
    exit 97
  }
  exit 1
}
