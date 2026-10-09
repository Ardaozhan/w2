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
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;

namespace W2 {
  public sealed class JobSetupException : Exception {
    public JobSetupException(string message) : base(message) { }
  }

  public static class JobRunner {
    private const uint CreateBreakawayFromJob = 0x01000000;
    private const uint CreateNoWindow = 0x08000000;
    private const uint CreateUnicodeEnvironment = 0x00000400;
    private const uint CreateSuspended = 0x00000004;
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
    private static extern uint ResumeThread(IntPtr thread);

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

    public static int Main(string[] args) {
      if (args.Length != 5) { Console.Error.WriteLine("W2 Windows Job Object runner received an invalid launch contract."); return 1; }
      try {
        bool timedOut;
        int exitCode = Run(Decode(args[0]), DecodeList(args[1]), Decode(args[2]), DecodeList(args[3]), Int64.Parse(args[4]), out timedOut);
        if (timedOut) Console.Error.WriteLine("W2_JOB_TIMED_OUT");
        return exitCode;
      } catch (JobSetupException error) {
        Console.Error.WriteLine(error.ToString());
        Console.Error.WriteLine("W2_JOB_SETUP_FAILED");
        return 97;
      } catch (Exception error) {
        Console.Error.WriteLine(error.ToString());
        return 1;
      }
    }

    private static string Decode(string value) { return Encoding.UTF8.GetString(Convert.FromBase64String(value)); }
    private static string[] DecodeList(string value) {
      byte[] bytes = Convert.FromBase64String(value);
      List<string> values = new List<string>();
      int offset = 0;
      while (offset < bytes.Length) {
        if (bytes.Length - offset < 4) throw new FormatException("Invalid W2 runner list payload");
        int length = BitConverter.ToInt32(bytes, offset);
        offset += 4;
        if (length < 0 || length > bytes.Length - offset) throw new FormatException("Invalid W2 runner list entry length");
        values.Add(Encoding.UTF8.GetString(bytes, offset, length));
        offset += length;
      }
      return values.ToArray();
    }

    private static int Run(string executable, string[] args, string currentDirectory, string[] environment, long timeoutMs, out bool timedOut) {
      timedOut = false;
      IntPtr job = CreateJobObjectW(IntPtr.Zero, null);
      if (job == IntPtr.Zero) throw new JobSetupException("CreateJobObjectW failed: " + LastError());

      IntPtr limitBuffer = IntPtr.Zero;
      IntPtr environmentBuffer = IntPtr.Zero;
      ProcessInformation process = new ProcessInformation();
      bool processCreated = false;
      try {
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

        string commandLineText = Quote(executable) + (args.Length == 0 ? "" : " " + String.Join(" ", args.Select(Quote)));
        StringBuilder commandLine = new StringBuilder(commandLineText);
        string resolvedFile = ResolveExecutable(executable);
        uint baseFlags = CreateNoWindow | CreateUnicodeEnvironment | CreateSuspended;
        if (!CreateProcessW(resolvedFile, commandLine, IntPtr.Zero, IntPtr.Zero, true, baseFlags | CreateBreakawayFromJob, environmentBuffer, currentDirectory, ref startup, out process)) {
          int breakawayError = Marshal.GetLastWin32Error();
          commandLine = new StringBuilder(commandLineText);
          if (!CreateProcessW(resolvedFile, commandLine, IntPtr.Zero, IntPtr.Zero, true, baseFlags, environmentBuffer, currentDirectory, ref startup, out process)) {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateProcessW failed (breakaway attempt: " + breakawayError + ")");
          }
        }
        processCreated = true;
        if (!AssignProcessToJobObject(job, process.process)) {
          TerminateProcess(process.process, 1);
          WaitForSingleObject(process.process, 5000);
          throw new JobSetupException("AssignProcessToJobObject failed: " + LastError());
        }
        if (ResumeThread(process.thread) == UInt32.MaxValue) throw new Win32Exception(Marshal.GetLastWin32Error(), "Resuming the assigned process failed");

        long deadlineEpochMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + timeoutMs;
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

  $cacheRoot = Join-Path ([IO.Path]::GetTempPath()) 'w2-job-runner-cache'
  [IO.Directory]::CreateDirectory($cacheRoot) | Out-Null
  $assemblyPath = Join-Path $cacheRoot 'w2-job-runner-v3.exe'
  $lockPath = Join-Path $cacheRoot 'w2-job-runner-v3.lock'
  if (!(Test-Path -LiteralPath $assemblyPath -PathType Leaf)) {
    $lock = $null
    for ($attempt = 0; $attempt -lt 400 -and !$lock; $attempt++) {
      try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
      catch [IO.IOException] { Start-Sleep -Milliseconds 25 }
    }
    if (!$lock) { throw 'Timed out waiting for the W2 Job Object helper cache lock.' }
    try {
      if (!(Test-Path -LiteralPath $assemblyPath -PathType Leaf)) {
        $temporaryAssembly = Join-Path $cacheRoot "w2-job-runner-v3-$([guid]::NewGuid().ToString('N')).exe"
        try {
          Add-Type -TypeDefinition $source -OutputAssembly $temporaryAssembly -OutputType ConsoleApplication -ErrorAction Stop | Out-Null
          [IO.File]::Move($temporaryAssembly, $assemblyPath)
        }
        finally {
          if (Test-Path -LiteralPath $temporaryAssembly) { Remove-Item -LiteralPath $temporaryAssembly -Force -ErrorAction SilentlyContinue }
        }
      }
    }
    finally { $lock.Dispose() }
  }
  function ConvertTo-RunnerListBase64([string[]]$values) {
    $stream = [IO.MemoryStream]::new()
    $writer = [IO.BinaryWriter]::new($stream)
    try {
      foreach ($value in $values) {
        $bytes = [Text.Encoding]::UTF8.GetBytes([string]$value)
        $writer.Write([int]$bytes.Length)
        $writer.Write($bytes)
      }
      $writer.Flush()
      return [Convert]::ToBase64String($stream.ToArray())
    }
    finally { $writer.Dispose(); $stream.Dispose() }
  }

  $argumentValues = [string[]]@(
    [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$payload.file)),
    (ConvertTo-RunnerListBase64 ([string[]]$payload.args)),
    [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$payload.cwd)),
    (ConvertTo-RunnerListBase64 ([string[]]$payload.environment)),
    [string]$payload.timeoutMs
  )
  & $assemblyPath @argumentValues
  exit $LASTEXITCODE
} catch {
  [Console]::Error.WriteLine($_.Exception.ToString())
  [Console]::Error.WriteLine("W2_JOB_SETUP_FAILED")
  exit 97
}
