/*
 * Rasadyar Data Model — Archive Repository
 *
 * Central read access for canonical archive records.
 * Archive writes are created through EvidenceRepository so Evidence and
 * Archive remain consistent.
 */

import {
  type RasadyarArchive,
  type RasadyarId,
} from "./schema";

import {
  readCanonicalStore,
} from "./storage";


export function getCanonicalArchiveById(
  archiveId:
    RasadyarId
): RasadyarArchive | null {
  const store =
    readCanonicalStore();

  return (
    store.archives[
      archiveId
    ] ||
    null
  );
}


export function listCanonicalArchives():
  RasadyarArchive[] {
  return Object.values(
    readCanonicalStore().archives
  );
}


export function listCanonicalArchivesByMediaType(
  mediaType:
    RasadyarArchive["mediaType"]
): RasadyarArchive[] {
  return listCanonicalArchives().filter(
    (
      archive
    ) =>
      archive.mediaType ===
      mediaType
  );
}


export function countCanonicalArchives(): {
  total:
    number;

  withSnapshot:
    number;
} {
  const archives =
    listCanonicalArchives();

  return {
    total:
      archives.length,

    withSnapshot:
      archives.filter(
        (
          archive
        ) =>
          Boolean(
            archive.snapshotDataUrl
          )
      ).length,
  };
}
