; Check the exact app process before launching the quit handoff. This preserves
; the #469 fix: unrelated helpers under $INSTDIR must never block an upgrade.
Var pid

LangString futurestaffWelcomeTitle 1033 "Meet your AI work partner"
LangString futurestaffWelcomeTitle 2052 "认识你的 AI 工作伙伴"
LangString futurestaffWelcomeTitle 1028 "認識你的 AI 工作夥伴"
LangString futurestaffWelcomeBody 1033 "FutureStaff Agent brings secure, tenant-aware AI workflows to this computer.$\r$\n$\r$\nThis guided setup keeps your workspace local, protects sign-in data with Windows, and prepares Product Hub access.$\r$\n$\r$\nSelect Next to review the installation."
LangString futurestaffWelcomeBody 2052 "FutureStaff Agent 将安全、具备租户隔离的 AI 工作流带到这台电脑。$\r$\n$\r$\n安装过程会保留本地工作区，使用 Windows 保护登录数据，并准备选品中心访问能力。$\r$\n$\r$\n请选择“下一步”检查安装设置。"
LangString futurestaffWelcomeBody 1028 "FutureStaff Agent 將安全、具備租戶隔離的 AI 工作流程帶到這台電腦。$\r$\n$\r$\n安裝過程會保留本機工作區，使用 Windows 保護登入資料，並準備選品中心存取能力。$\r$\n$\r$\n請選擇「下一步」檢查安裝設定。"
LangString futurestaffReviewTitle 1033 "Ready for FutureStaff"
LangString futurestaffReviewTitle 2052 "准备安装 FutureStaff"
LangString futurestaffReviewTitle 1028 "準備安裝 FutureStaff"
LangString futurestaffReviewSubtitle 1033 "Confirm the destination and protected desktop defaults"
LangString futurestaffReviewSubtitle 2052 "确认安装位置和安全桌面默认设置"
LangString futurestaffReviewSubtitle 1028 "確認安裝位置和安全桌面預設設定"
LangString futurestaffReviewLead 1033 "AI capability, grounded in your workspace"
LangString futurestaffReviewLead 2052 "让 AI 能力扎根于你的工作区"
LangString futurestaffReviewLead 1028 "讓 AI 能力扎根於你的工作區"
LangString futurestaffReviewPath 1033 "INSTALL LOCATION"
LangString futurestaffReviewPath 2052 "安装位置"
LangString futurestaffReviewPath 1028 "安裝位置"
LangString futurestaffReviewSecurity 1033 "Windows-protected sign-in  •  Loopback-only desktop service  •  Isolated FutureStaff Profile"
LangString futurestaffReviewSecurity 2052 "Windows 保护登录  •  仅本机桌面服务  •  独立 FutureStaff Profile"
LangString futurestaffReviewSecurity 1028 "Windows 保護登入  •  僅本機桌面服務  •  獨立 FutureStaff Profile"
LangString futurestaffReviewHint 1033 "Use Back to change the folder, or Install to continue."
LangString futurestaffReviewHint 2052 "如需修改目录请选择“上一步”，确认后请选择“安装”。"
LangString futurestaffReviewHint 1028 "如需修改目錄請選擇「上一步」，確認後請選擇「安裝」。"

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "$(futurestaffWelcomeTitle)"
  !define MUI_WELCOMEPAGE_TEXT "$(futurestaffWelcomeBody)"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customPageAfterChangeDir
  Var futurestaffReviewDialog
  Var futurestaffReviewTitleControl
  Var futurestaffReviewPathControl
  Var futurestaffReviewSecurityControl
  Page custom futurestaffReviewCreate

  Function futurestaffReviewCreate
    GetDlgItem $0 $HWNDPARENT 1037
    SendMessage $0 0x000C 0 "STR:$(futurestaffReviewTitle)"
    GetDlgItem $0 $HWNDPARENT 1038
    SendMessage $0 0x000C 0 "STR:$(futurestaffReviewSubtitle)"
    nsDialogs::Create 1018
    Pop $futurestaffReviewDialog
    StrCmp $futurestaffReviewDialog error 0 +2
    Abort

    SetCtlColors $futurestaffReviewDialog 0xEAF6FF 0x071326

    nsDialogs::CreateControl STATIC 0x50000000 0 12u 10u 276u 22u "$(futurestaffReviewLead)"
    Pop $futurestaffReviewTitleControl
    CreateFont $0 "Segoe UI" 15 700
    SendMessage $futurestaffReviewTitleControl 0x0030 $0 1
    SetCtlColors $futurestaffReviewTitleControl 0x45D9FF 0x071326

    nsDialogs::CreateControl STATIC 0x50000000 0 12u 47u 276u 12u "$(futurestaffReviewPath)"
    Pop $0
    CreateFont $1 "Segoe UI" 8 700
    SendMessage $0 0x0030 $1 1
    SetCtlColors $0 0x8EA8C7 0x071326

    nsDialogs::CreateControl STATIC 0x50000000 0 12u 63u 276u 24u "$INSTDIR"
    Pop $futurestaffReviewPathControl
    CreateFont $1 "Segoe UI" 10 600
    SendMessage $futurestaffReviewPathControl 0x0030 $1 1
    SetCtlColors $futurestaffReviewPathControl 0xFFFFFF 0x102746

    nsDialogs::CreateControl STATIC 0x50000000 0 12u 103u 276u 34u "$(futurestaffReviewSecurity)"
    Pop $futurestaffReviewSecurityControl
    CreateFont $1 "Segoe UI" 9 500
    SendMessage $futurestaffReviewSecurityControl 0x0030 $1 1
    SetCtlColors $futurestaffReviewSecurityControl 0x8CEBFF 0x0B1D3A

    nsDialogs::CreateControl STATIC 0x50000000 0 12u 151u 276u 28u "$(futurestaffReviewHint)"
    Pop $0
    CreateFont $1 "Segoe UI" 9 400
    SendMessage $0 0x0030 $1 1
    SetCtlColors $0 0xB8CAE0 0x071326

    nsDialogs::Show
  FunctionEnd
!macroend

!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
  ${if} $R0 != 0
    Goto dsh_installer_app_stopped
  ${endIf}

  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 dsh_installer_scoped_fallback
    ; Newer versions receive this through Electron's single-instance channel.
    ; 2.0.2 ignores it, so the scoped builder fallback remains necessary for
    ; the first upgrade to a version that supports orderly shutdown.
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --dsh-installer-quit'
    StrCpy $R1 0

  dsh_installer_wait_for_exit:
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 != 0
      Goto dsh_installer_app_stopped
    ${endIf}
    IntOp $R1 $R1 + 1
    ; Slow disks, antivirus hooks, and a large physical runtime can keep the
    ; process alive after Cordis disposal begins. Give the orderly handoff a
    ; full 30 seconds before escalating to the scoped forced-close path.
    ${if} $R1 < 60
      Sleep 500
      Goto dsh_installer_wait_for_exit
    ${endIf}

  dsh_installer_scoped_fallback:
    ; The patched builder macros match DSH Desktop.exe, not every executable
    ; below $INSTDIR. They handle pre-handoff releases and stubborn processes.
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK dsh_installer_stop_app
    Quit

  dsh_installer_stop_app:
    DetailPrint "$(appClosing)"
    ; KILL_PROCESS's tasklist fallback excludes $pid. The installer never has
    ; the application executable name, so zero is a safe sentinel here.
    StrCpy $pid 0
    !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 0
    Sleep 500
    StrCpy $R1 0

  dsh_installer_wait_for_fallback:
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 != 0
      Goto dsh_installer_app_stopped
    ${endIf}
    IntOp $R1 $R1 + 1
    ${if} $R1 > 1
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY dsh_installer_wait_for_fallback
      Quit
    ${endIf}
    Sleep 1000
    !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 1
    Sleep 500
    Goto dsh_installer_wait_for_fallback

  dsh_installer_app_stopped:
!macroend
