#define AppVersion "0.1.0-alpha.1"

[Setup]
AppId={{E88272DF-69BB-4E4D-B8CB-9B416E036E67}
AppName=FutureStaff Local Runner
AppVersion={#AppVersion}
AppPublisher=FutureStaff
DefaultDirName={autopf}\FutureStaff Local Runner
DisableProgramGroupPage=yes
OutputDir=..\..\..\outputs
OutputBaseFilename=FutureStaff-Local-Runner-Alpha-Setup
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=FutureStaff Local Runner
WizardStyle=modern

[Files]
Source: "..\..\..\dist\runner-windows\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{commonappdata}\FutureStaff\LocalRunner"
Name: "{commonappdata}\FutureStaff\LocalRunner\logs"

[Run]
Filename: "{app}\service\FutureStaffRunner.exe"; Parameters: "install"; Flags: runhidden waituntilterminated
Filename: "{app}\service\FutureStaffRunner.exe"; Parameters: "start"; Flags: runhidden waituntilterminated

[UninstallRun]
Filename: "{app}\service\FutureStaffRunner.exe"; Parameters: "stop"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "StopFutureStaffRunner"
Filename: "{app}\service\FutureStaffRunner.exe"; Parameters: "uninstall"; Flags: runhidden waituntilterminated skipifdoesntexist; RunOnceId: "RemoveFutureStaffRunner"

[Code]
var
  EnrollmentPage: TInputQueryWizardPage;

function JsonEscape(Value: String): String;
begin
  Result := Value;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '"', '\"', True);
  StringChangeEx(Result, #13, '', True);
  StringChangeEx(Result, #10, '', True);
end;

procedure InitializeWizard;
begin
  EnrollmentPage := CreateInputQueryPage(
    wpSelectDir,
    '绑定这台电脑',
    '连接到 FutureStaff',
    '请输入管理员提供的一次性绑定码，并为这台电脑设置一个容易识别的名称。'
  );
  EnrollmentPage.Add('设备名称:', False);
  EnrollmentPage.Add('一次性绑定码:', True);
  EnrollmentPage.Values[0] := GetComputerNameString;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = EnrollmentPage.ID then
  begin
    if (Length(Trim(EnrollmentPage.Values[0])) < 1) or
       (Length(Trim(EnrollmentPage.Values[0])) > 100) then
    begin
      MsgBox('设备名称长度必须为 1–100 个字符。', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if (Length(Trim(EnrollmentPage.Values[1])) < 8) or
       (Length(Trim(EnrollmentPage.Values[1])) > 200) then
    begin
      MsgBox('一次性绑定码无效。', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  DataDir: String;
  BootstrapPath: String;
  BootstrapJson: String;
  ResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    DataDir := ExpandConstant('{commonappdata}\FutureStaff\LocalRunner');
    BootstrapPath := DataDir + '\bootstrap.json';
    ForceDirectories(DataDir);
    BootstrapJson :=
      '{"gatewayUrl":"https://dsh.fsstory.net/","deviceName":"' +
      JsonEscape(Trim(EnrollmentPage.Values[0])) + '","code":"' +
      JsonEscape(Trim(EnrollmentPage.Values[1])) + '"}';
    if not SaveStringToFile(BootstrapPath, BootstrapJson, False) then
      RaiseException('无法写入安全的绑定配置。');
    if not Exec(
      ExpandConstant('{sys}\icacls.exe'),
      '"' + DataDir + '" /inheritance:r /grant:r "*S-1-5-19:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode
    ) or (ResultCode <> 0) then
      RaiseException('无法保护本地绑定配置。');
  end;
end;
