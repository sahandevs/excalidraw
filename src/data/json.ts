import { fileOpen, fileSave, FileSystemHandle } from "browser-fs-access";
import { cleanAppStateForExport } from "../appState";
import { EXPORT_DATA_TYPES, EXPORT_SOURCE, MIME_TYPES } from "../constants";
import { clearElementsForExport } from "../element";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { loadFromBlob } from "./blob";

import {
  ExportedDataState,
  ImportedDataState,
  ExportedLibraryData,
} from "./types";
import Library from "./library";
import { AbortError } from "../errors";

export const serializeAsJSON = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): string => {
  const data: ExportedDataState = {
    type: EXPORT_DATA_TYPES.excalidraw,
    version: 2,
    source: EXPORT_SOURCE,
    elements: clearElementsForExport(elements),
    appState: cleanAppStateForExport(appState),
  };

  return JSON.stringify(data, null, 2);
};

// adapted from https://web.dev/file-system-access
const verifyPermission = async (fileHandle: FileSystemHandle) => {
  try {
    const options = { mode: "readwrite" } as any;
    // Check if permission was already granted. If so, return true.
    if ((await fileHandle.queryPermission(options)) === "granted") {
      return true;
    }
    // Request permission. If the user grants permission, return true.
    if ((await fileHandle.requestPermission(options)) === "granted") {
      return true;
    }
    // The user didn't grant permission, so return false.
    return false;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export const saveAsJSON = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const serialized = serializeAsJSON(elements, appState);
  const blob = new Blob([serialized], {
    type: MIME_TYPES.excalidraw,
  });

  if (appState.fileHandle) {
    if (!(await verifyPermission(appState.fileHandle))) {
      throw new AbortError();
    }
  }

  const fileHandle = await fileSave(
    blob,
    {
      fileName: `${appState.name}.excalidraw`,
      description: "Excalidraw file",
      extensions: [".excalidraw"],
    },
    appState.fileHandle,
  );
  return { fileHandle };
};

export const loadFromJSON = async (localAppState: AppState) => {
  const blob = await fileOpen({
    description: "Excalidraw files",
    // ToDo: Be over-permissive until https://bugs.webkit.org/show_bug.cgi?id=34442
    // gets resolved. Else, iOS users cannot open `.excalidraw` files.
    /*
    extensions: [".json", ".excalidraw", ".png", ".svg"],
    mimeTypes: [
      MIME_TYPES.excalidraw,
      "application/json",
      "image/png",
      "image/svg+xml",
    ],
    */
  });
  return loadFromBlob(blob, localAppState);
};

export const isValidExcalidrawData = (data?: {
  type?: any;
  elements?: any;
  appState?: any;
}): data is ImportedDataState => {
  return (
    data?.type === EXPORT_DATA_TYPES.excalidraw &&
    (!data.elements ||
      (Array.isArray(data.elements) &&
        (!data.appState || typeof data.appState === "object")))
  );
};

export const isValidLibrary = (json: any) => {
  return (
    typeof json === "object" &&
    json &&
    json.type === EXPORT_DATA_TYPES.excalidrawLibrary &&
    json.version === 1
  );
};

export const saveLibraryAsJSON = async (library: Library) => {
  const libraryItems = await library.loadLibrary();
  const data: ExportedLibraryData = {
    type: EXPORT_DATA_TYPES.excalidrawLibrary,
    version: 1,
    source: EXPORT_SOURCE,
    library: libraryItems,
  };
  const serialized = JSON.stringify(data, null, 2);
  const fileName = "library.excalidrawlib";
  const blob = new Blob([serialized], {
    type: MIME_TYPES.excalidrawlib,
  });
  await fileSave(blob, {
    fileName,
    description: "Excalidraw library file",
    extensions: [".excalidrawlib"],
  });
};

export const importLibraryFromJSON = async (library: Library) => {
  const blob = await fileOpen({
    description: "Excalidraw library files",
    // ToDo: Be over-permissive until https://bugs.webkit.org/show_bug.cgi?id=34442
    // gets resolved. Else, iOS users cannot open `.excalidraw` files.
    /*
    extensions: [".json", ".excalidrawlib"],
    */
  });
  await library.importLibrary(blob);
};
