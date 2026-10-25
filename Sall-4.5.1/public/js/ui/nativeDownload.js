import { translations, t } from "../i18n/index.js";
import {
  showToast,
  Filesystem,
  requestWakeLock,
  releaseWakeLock,
  checkWifiOnlyGuard,
  normalizePathInput,
} from "../utils/index.js";
import { currentLang } from "../modules/core.js";
import {
  resolveExtension,
  sanitizeTitle,
  generateFileName,
  detectPlatformFolder,
  resolveUniqueFileName,
} from "../downloader/filename.js";
import { cleanDownloadUrl, buildDownloadHeaders } from "../downloader/headers.js";
import { needsAsyncResolving, resolveDownloadUrl } from "../downloader/resolver.js";
import { saveToStorage } from "../downloader/storage.js";
import { handlePostDownload } from "../downloader/postProcess.js";
import { downloadBubble } from "./downloadBubble.js";

export function cancelCurrentDownload() {
  window._sallDownloadCancelled = true;
  // Dispatch event so history spinner can be cleared
  window.dispatchEvent(new CustomEvent("sall_download_cancelled"));
}

// Expose globally so cancellation can be called from anywhere
window._sallCancelDownload = cancelCurrentDownload;

function handleCancelCleanup(btn, originalContent, progressContainer) {
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
  if (progressContainer) progressContainer.classList.add("hidden");
}

export async function startNativeDownload(
  url,
  type,
  title,
  btn,
  sourceUrl,
  resetCancelFlag = true,
) {
  if (!url || typeof url !== "string" || !url.trim()) {
    showToast(
      (translations[currentLang]?.["label-error"] || "Error") +
        ": Invalid download link",
    );
    return { success: false, error: "Invalid download link" };
  }

  if (!(await checkWifiOnlyGuard())) {
    return { success: false, error: "Wifi only guard" };
  }

  if (
    url.startsWith("file://") ||
    url.includes("_capacitor_file_") ||
    url.startsWith("content://")
  ) {
    showToast(t("toast-already-local"));
    return { success: true, skipped: true };
  }

  const tauriInvoke =
    window.__TAURI__?.core?.invoke ||
    window.__TAURI_INTERNALS__?.invoke ||
    window.__TAURI__?.invoke;

  if (!Filesystem && !tauriInvoke) {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.target = "_blank";
      a.click();
    } catch (_) {
      window.open(url, "_blank");
    }
    return { success: true };
  }

  if (resetCancelFlag) {
    window._sallDownloadCancelled = false;
  }
  // If batch already cancelled, bail immediately
  if (window._sallDownloadCancelled) {
    return { success: false, error: "Cancelled" };
  }

  window._sallActiveDownloadUrl = sourceUrl || url;
  window.dispatchEvent(
    new CustomEvent("sall_download_started", {
      detail: { url: sourceUrl || url },
    }),
  );

  const progressBar = document.getElementById("progressBar");
  const progressContainer = document.getElementById("progressContainer");
  const originalContent = btn ? btn.innerHTML : "";

  if (window.Capacitor?.getPlatform?.() === "android") {
    try {
      const status = await Filesystem.checkPermissions();
      if (status.publicStorage !== "granted") {
        await Filesystem.requestPermissions().catch(() => {});
      }
    } catch (e) {
      console.warn("Permission check failed", e);
    }
  }

  // Show floating progress toast ONLY AFTER validation and permissions pass
  const platformLabel = (() => {
    const src = (sourceUrl || url || "").toLowerCase();
    if (src.includes("tiktok")) return "TikTok";
    if (src.includes("instagram")) return "Instagram";
    if (src.includes("youtube")) return "YouTube";
    if (src.includes("twitter") || /(?:^|[/.])x\.com(?:[/?#:]|$)/i.test(src))
      return "Twitter";
    if (src.includes("facebook")) return "Facebook";
    if (src.includes("pinterest")) return "Pinterest";
    if (src.includes("douyin")) return "Douyin";
    if (src.includes("bilibili") || src.includes("b23.tv")) return "Bilibili";
    if (src.includes("spotify")) return "Spotify";
    if (src.includes("bandcamp")) return "Bandcamp";
    if (src.includes("pixiv") || src.includes("pximg")) return "Pixiv";
    if (src.includes("xiaohongshu") || src.includes("rednote"))
      return "RedNote";
    if (src.includes("threads")) return "Threads";
    if (src.includes("reddit") || src.includes("redd.it")) return "Reddit";
    if (
      src.includes("terabox") ||
      src.includes("1024tera") ||
      src.includes("nephobox") ||
      src.includes("4funbox") ||
      src.includes("mirrobox") ||
      src.includes("momerybox") ||
      src.includes("tibibox")
    )
      return "TeraBox";
    if (src.includes("snapchat")) return "Snapchat";
    return "Media";
  })();

  if (window._sallActiveSimInterval) {
    clearInterval(window._sallActiveSimInterval);
    window._sallActiveSimInterval = null;
  }

  window._sallActiveDownloadsCount =
    (window._sallActiveDownloadsCount || 0) + 1;

  const hideProgress = localStorage.getItem("sall_hide_progress") === "true";
  const isMultiDownload =
    window._sallPlaylistDownloading || window._sallActiveDownloadsCount > 1;

  let effectiveTitle = title || "Sall Media";
  const dlId = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let itemCancelled = false;

  downloadBubble.addDownload({
    id: dlId,
    title: effectiveTitle,
    platform: platformLabel,
    type: type,
    onCancel: () => {
      itemCancelled = true;
    },
  });

  let currentProgressVal = 0;
  const updateProgress = (pct, statusText) => {
    if (hideProgress) return;
    if (typeof pct === "number" && !isNaN(pct)) {
      const maxCap = pct >= 100 ? 100 : 99;
      const targetPct = Math.min(
        maxCap,
        Math.max(currentProgressVal, Math.round(pct)),
      );
      currentProgressVal = targetPct;
    }
    if (progressBar) progressBar.style.width = `${currentProgressVal}%`;
    downloadBubble.updateProgress(dlId, currentProgressVal, statusText);
  };

  try {
    if (btn) btn.disabled = true;
    if (progressContainer) progressContainer.classList.remove("hidden");
    updateProgress(0, "Downloading...");

    // Acquire Wake Lock & Start Native Foreground Service
    requestWakeLock();
    if (window.SallMainBridge?.startDownloadService) {
      try {
        window.SallMainBridge.startDownloadService(
          `Downloading ${platformLabel} ${type || ""}`,
        );
      } catch (e) {
        console.warn("Foreground service start error", e);
      }
    }

    const initialBadge = btn ? btn.querySelector(".dl-badge") : null;
    if (btn) {
      if (initialBadge) {
        initialBadge.textContent = "...";
      } else {
        btn.innerHTML =
          translations[currentLang]?.["btn-processing"] || "Processing...";
      }
    }
    console.log("Starting download for:", url);

    let simProgress = 0;
    let realProgressReceived = false;
    window._sallActiveSimInterval = setInterval(() => {
      if (realProgressReceived) return;
      if (simProgress < 50) {
        simProgress += 6 + Math.random() * 4;
      } else if (simProgress < 80) {
        simProgress += 2.5 + Math.random() * 2.5;
      } else if (simProgress < 95) {
        simProgress += 0.6 + Math.random() * 0.9;
      }
      const currentPct = Math.min(95, Math.round(simProgress));
      updateProgress(currentPct, "Downloading...");
    }, 160);

    // Remove any existing listeners first to avoid double-firing
    if (window._sallProgressListener) {
      try {
        await window._sallProgressListener.remove();
      } catch (_) {}
      window._sallProgressListener = null;
    }

    // Listen for real progress if Filesystem exists
    if (Filesystem?.addListener) {
      try {
        window._sallProgressListener = await Filesystem.addListener(
          "downloadProgress",
          (progress) => {
            realProgressReceived = true;
            let percentage = 0;
            if (progress.contentLength > 0) {
              percentage = Math.round(
                (progress.bytesWritten / progress.contentLength) * 100,
              );
            } else if (progress.bytesWritten > 0) {
              percentage = Math.min(
                95,
                Math.round(progress.bytesWritten / 10240),
              );
            }
            updateProgress(Math.min(95, percentage), "Downloading...");
          },
        );
      } catch (e) {
        console.warn("Could not attach Filesystem progress listener:", e);
      }
    }

    const ext = resolveExtension(type, url);
    const cleanTypeLabel = (type || "")
      .replace(/\s*\[(MP3|MP4|JPG|PNG|WEBP)\]/gi, "")
      .trim();
    const isTrackType = /^\d+\.\s+/.test(cleanTypeLabel);
    if (isTrackType) {
      effectiveTitle =
        cleanTypeLabel.replace(/^\d+\.\s+/, "").trim() || cleanTypeLabel;
    }

    const sanitizedTitle = sanitizeTitle(title, type);
    let fileName = generateFileName(sanitizedTitle, ext, sourceUrl, url);

    const isAudio = /mp3|audio|128k|48k|m4a|wav|flac/i.test(type);
    const rawVideoFolder = (localStorage.getItem("sall_download_path") || "").trim();
    const rawMusicFolder = (localStorage.getItem("sall_music_path") || "").trim();

    const isAndroid = window.Capacitor?.getPlatform?.() === "android";
    const hasAllFiles = isAndroid && window.SallMainBridge?.hasAllFilesPermission
      ? window.SallMainBridge.hasAllFilesPermission()
      : true;

    const defaultVideoFolder = "Download/Sall";
    const defaultMusicFolder = isAndroid ? "Download/Sall/Music" : "Music/Sall";

    let targetFolder = isAudio
      ? (rawMusicFolder || defaultMusicFolder)
      : (rawVideoFolder || defaultVideoFolder);

    if (targetFolder === "Sall") {
      targetFolder = defaultVideoFolder;
    } else if (targetFolder === "Sall/Music") {
      targetFolder = defaultMusicFolder;
    }

    targetFolder =
      normalizePathInput(targetFolder) ||
      (isAudio ? defaultMusicFolder : defaultVideoFolder);

    // Android Scoped Storage fallback:
    // If All Files Access is not granted, automatically save into Download/Sall default
    if (isAndroid && !hasAllFiles) {
      if (!targetFolder.toLowerCase().startsWith("download")) {
        targetFolder = isAudio ? "Download/Sall/Music" : "Download/Sall";
      }
    }

    let fullPath = targetFolder;

    // Auto-Categorize Subfolder per Platform
    if (localStorage.getItem("sall_auto_folder") !== "false") {
      const platformFolder = detectPlatformFolder(sourceUrl, url);
      fullPath = `${fullPath}/${platformFolder}`;
    }

    const directoriesToTry = ["EXTERNAL_STORAGE", "DOCUMENTS", "EXTERNAL"];

    if (Filesystem) {
      for (const dir of directoriesToTry) {
        await Filesystem.mkdir({
          path: fullPath,
          directory: dir,
          recursive: true,
        }).catch((e) => {
          console.warn(`Mkdir on ${dir} failed or exists:`, e);
        });
      }

      const uniqueRes = await resolveUniqueFileName(
        fullPath,
        fileName,
        ext,
        directoriesToTry,
        Filesystem,
        btn,
      );
      if (uniqueRes.skipped) {
        return {
          success: true,
          skipped: true,
          path: uniqueRes.path,
        };
      }
      fileName = uniqueRes.fileName;
    }

    const checkCancelled = () =>
      Boolean(window._sallDownloadCancelled || itemCancelled);

    if (checkCancelled()) {
      downloadBubble.cancelDownload(dlId);
      handleCancelCleanup(btn, originalContent, progressContainer);
      return { success: false, error: "Cancelled" };
    }

    let actualDownloadUrl = url;
    if (needsAsyncResolving(url)) {
      const resolveRes = await resolveDownloadUrl({
        url,
        btn,
        updateProgress,
        checkCancelled,
      });
      if (resolveRes.cancelled || checkCancelled()) {
        downloadBubble.cancelDownload(dlId);
        handleCancelCleanup(btn, originalContent, progressContainer);
        return { success: false, error: "Cancelled" };
      }
      actualDownloadUrl = resolveRes.url;
    }

    actualDownloadUrl = cleanDownloadUrl(actualDownloadUrl);
    const downloadHeaders = buildDownloadHeaders(
      actualDownloadUrl,
      sourceUrl,
      url,
    );

    const { savedFile, successfulDir, cancelled } = await saveToStorage({
      actualDownloadUrl,
      fileName,
      fullPath,
      targetFolder,
      downloadHeaders,
      directoriesToTry,
      checkCancelled,
    });

    if (cancelled || checkCancelled()) {
      downloadBubble.cancelDownload(dlId);
      handleCancelCleanup(btn, originalContent, progressContainer);
      return { success: false, error: "Cancelled" };
    }

    if (window._sallActiveSimInterval) {
      clearInterval(window._sallActiveSimInterval);
      window._sallActiveSimInterval = null;
    }

    updateProgress(100, "Downloading...");
    if (btn) {
      const b = btn.querySelector(".dl-badge");
      if (b) {
        b.textContent = "SAVED";
        b.style.backgroundColor = "";
        b.style.color = "";
      } else {
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="margin-right:8px"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> SAVED`;
      }
    }

    const postRes = await handlePostDownload({
      savedFile,
      successfulDir,
      sourceUrl,
      url,
      effectiveTitle,
      fileName,
      targetFolder,
      btn,
      originalContent,
      progressContainer,
    });
    downloadBubble.completeDownload(dlId, "Saved");
    return postRes;
  } catch (err) {
    console.error("Download failed", err);
    if (window._sallActiveSimInterval) {
      clearInterval(window._sallActiveSimInterval);
      window._sallActiveSimInterval = null;
    }

    let errorMsg = err?.message || "Download failed";
    if (
      errorMsg.includes("Network") ||
      errorMsg.includes("timeout") ||
      errorMsg.includes("connection")
    ) {
      errorMsg =
        translations[currentLang]?.["toast-connection-lost"] ||
        "Network connection error";
    }

    downloadBubble.failDownload(dlId, errorMsg);

    // Trigger System Tray Notification when download fails
    if (
      !window._sallPlaylistDownloading &&
      window.SallMainBridge?.showFailedNotification
    ) {
      try {
        window.SallMainBridge.showFailedNotification(
          effectiveTitle || "Media",
          errorMsg,
        );
      } catch (_) {}
    }

    if (btn) {
      btn.disabled = false;
      const b = btn.querySelector(".dl-badge");
      if (b) {
        if (window._sallPlaylistDownloading) {
          b.textContent = t("status-failed");
          b.style.backgroundColor = "var(--color-danger, #ef4444)";
          b.style.color = "#ffffff";
        } else {
          b.textContent =
            translations[currentLang]?.["label-download"] || "DOWNLOAD";
        }
      } else {
        btn.innerHTML = originalContent;
      }
    }
    if (!window._sallPlaylistDownloading && progressContainer) {
      progressContainer.classList.add("hidden");
    }

    return {
      success: false,
      error: errorMsg,
    };
  } finally {
    window._sallActiveDownloadsCount = Math.max(
      0,
      (window._sallActiveDownloadsCount || 1) - 1,
    );
    window._sallActiveDownloadUrl = null;
    window.dispatchEvent(new CustomEvent("sall_download_ended"));
    if (!window._sallPlaylistDownloading) {
      releaseWakeLock();
      if (window.SallMainBridge?.stopDownloadService) {
        try {
          window.SallMainBridge.stopDownloadService();
        } catch (_) {}
      }
    }
    if (window._sallActiveSimInterval) {
      clearInterval(window._sallActiveSimInterval);
      window._sallActiveSimInterval = null;
    }
    if (window._sallProgressListener) {
      await window._sallProgressListener.remove();
      window._sallProgressListener = null;
    }
  }
}
