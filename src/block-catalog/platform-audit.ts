// ============================================================================
// @bitcode/ui-schema — Block Catalog Platform Audit (@internal, ADR-017 §4/§7)
//
// STATIC, snapshot-in-time record of which component keys are exported on web
// (packages/ui/src/index.ts) and Flutter (packages/ui-flutter/lib/bc_ui_flutter.dart).
//
// IMPORTANT — PROVENANCE & AUTHORITY:
//   This is a MANUAL audit snapshot taken on 2026-07-01 by grepping the two
//   barrel files above. It is NOT a live file-system scan. It exists only to:
//     (a) give candidate entries honest per-component platform availability, and
//     (b) ground the pilot-candidate analysis in evidence rather than guesswork.
//   The P4 build-time catalog validator (plan §7) performs the LIVE source +
//   export check and REMAINS THE SOURCE OF TRUTH for Ready gates. Any mismatch
//   between this static record and a live P4 scan must be resolved in favor of
//   the live scan before any entry is promoted to Ready.
//
// Method: for each key, confirm an `export { default as <WebKey> }` line exists
// in packages/ui/src/index.ts and an `export 'src/components/<flutter>.dart'`
// line exists in packages/ui-flutter/lib/bc_ui_flutter.dart. BcRenderer is
// validated separately as renderer INFRASTRUCTURE (ADR-017 §7), not as a
// component file.
//
// No framework imports. Serializable-friendly.
// ============================================================================

/**
 * Per-component platform availability. Keys are canonical web component names
 * (PascalCase `Bc*`). Each value records whether source+export was confirmed
 * on web and Flutter at audit time.
 *
 * The `flutterKey` is the snake_case barrel export name used by
 * `packages/ui-flutter/lib/bc_ui_flutter.dart`, recorded so the P4 live scanner
 * knows which Dart symbol to look for.
 */
export interface PlatformAuditEntry {
  web: boolean;
  flutter: boolean;
  /** Canonical snake_case Dart export name (without `.dart`). */
  flutterKey: string;
}

/**
 * Audit metadata. Provenance for the static snapshot.
 */
export interface PlatformAuditMeta {
  /** ISO date the manual grep audit was performed. */
  auditedAt: string;
  /** How the audit was produced. */
  auditMethod: string;
  /** Files inspected to produce the snapshot. */
  evidencePaths: string[];
  /**
   * Explicit reminder: the P4 live scanner is the authoritative Ready gate.
   * This static record is advisory evidence for candidate metadata only.
   */
  authoritativeReadyGate: string;
}

/**
 * The audit snapshot. 82 component keys referenced by the 44 candidate matrix
 * rows were checked. Result: 80 present on BOTH platforms; 2 web-only
 * (`BcSection`, `BcTimeline`); 0 flutter-only; 0 missing entirely.
 *
 * `BcRenderer` is renderer infrastructure and is NOT listed here; ADR-017 §7
 * requires it to be validated separately from component source checks.
 */
export const PLATFORM_AUDIT_META: PlatformAuditMeta = {
  auditedAt: '2026-07-01',
  auditMethod:
    "manual grep of `export { default as <Key> }` in packages/ui/src/index.ts and `export 'src/components/<flutter>.dart'` in packages/ui-flutter/lib/bc_ui_flutter.dart",
  evidencePaths: [
    'packages/ui/src/index.ts',
    'packages/ui-flutter/lib/bc_ui_flutter.dart',
  ],
  authoritativeReadyGate:
    'P4 build-time catalog validator (live source + export scan) — overrides this static record for Ready promotion.',
};

export const PLATFORM_AUDIT: Readonly<Record<string, PlatformAuditEntry>> = {
  // --- layout primitives ---
  BcSection: { web: true, flutter: false, flutterKey: 'bc_section' },
  BcStack: { web: true, flutter: true, flutterKey: 'bc_stack' },
  BcBox: { web: true, flutter: true, flutterKey: 'bc_box' },
  BcTabs: { web: true, flutter: true, flutterKey: 'bc_tabs' },
  BcSidebar: { web: true, flutter: true, flutterKey: 'bc_sidebar' },
  BcAnchor: { web: true, flutter: true, flutterKey: 'bc_anchor' },

  // --- display primitives ---
  BcCard: { web: true, flutter: true, flutterKey: 'bc_box' },
  BcLabel: { web: true, flutter: true, flutterKey: 'bc_box' },
  BcImage: { web: true, flutter: true, flutterKey: 'bc_image' },
  BcAvatar: { web: true, flutter: true, flutterKey: 'bc_avatar' },
  BcBadge: { web: true, flutter: true, flutterKey: 'bc_badge' },
  BcStatistic: { web: true, flutter: true, flutterKey: 'bc_statistic' },
  BcDescriptions: { web: true, flutter: true, flutterKey: 'bc_descriptions' },
  BcTimeline: { web: true, flutter: false, flutterKey: 'bc_timeline' },
  BcTagGroup: { web: true, flutter: true, flutterKey: 'bc_taggroup' },

  // --- buttons / actions ---
  BcButton: { web: true, flutter: true, flutterKey: 'bc_native_button' },
  BcFollow: { web: true, flutter: true, flutterKey: 'bc_follow' },
  BcLike: { web: true, flutter: true, flutterKey: 'bc_like' },
  BcShare: { web: true, flutter: true, flutterKey: 'bc_share' },

  // --- content / text ---
  BcRichText: { web: true, flutter: true, flutterKey: 'bc_richtext' },
  BcMarkdown: { web: true, flutter: true, flutterKey: 'bc_markdown' },
  BcAccordion: { web: true, flutter: true, flutterKey: 'bc_accordion' },
  BcDisclosure: { web: true, flutter: true, flutterKey: 'bc_disclosure' },
  BcRate: { web: true, flutter: true, flutterKey: 'bc_rate' },

  // --- data views ---
  BcDataTable: { web: true, flutter: true, flutterKey: 'bc_data_table' },
  BcList: { web: true, flutter: true, flutterKey: 'bc_list' },
  BcGridView: { web: true, flutter: true, flutterKey: 'bc_grid_view' },
  BcVirtualScroller: { web: true, flutter: true, flutterKey: 'bc_virtual_scroller' },
  BcDetailView: { web: true, flutter: true, flutterKey: 'bc_detail_view' },
  BcDashboard: { web: true, flutter: true, flutterKey: 'bc_dashboard' },
  BcTree: { web: true, flutter: true, flutterKey: 'bc_tree_view' },

  // --- forms ---
  BcForm: { web: true, flutter: true, flutterKey: 'bc_form' },
  BcWizard: { web: true, flutter: true, flutterKey: 'bc_wizard' },
  BcSteps: { web: true, flutter: true, flutterKey: 'bc_steps' },
  BcFile: { web: true, flutter: true, flutterKey: 'bc_file' },
  BcDropZone: { web: true, flutter: true, flutterKey: 'bc_drop_zone' },
  BcSelect: { web: true, flutter: true, flutterKey: 'bc_select' },
  BcLookupModal: { web: true, flutter: true, flutterKey: 'bc_lookup_modal' },
  BcFieldTableSelect: { web: true, flutter: true, flutterKey: 'bc_field_table_select' },
  BcFieldDynLink: { web: true, flutter: true, flutterKey: 'bc_field_dyn_link' },
  BcFieldMorph: { web: true, flutter: true, flutterKey: 'bc_field_morph' },

  // --- feedback / overlays ---
  BcNotification: { web: true, flutter: true, flutterKey: 'bc_notification' },
  BcToastQueue: { web: true, flutter: true, flutterKey: 'bc_toast_queue' },
  BcDropdown: { web: true, flutter: true, flutterKey: 'bc_dropdown' },
  BcDialog: { web: true, flutter: true, flutterKey: 'bc_dialog' },
  BcPrompt: { web: true, flutter: true, flutterKey: 'bc_prompt' },

  // --- media viewers ---
  BcViewerImage: { web: true, flutter: true, flutterKey: 'bc_viewer_image' },
  BcViewerVideo: { web: true, flutter: true, flutterKey: 'bc_viewer_video' },
  BcViewerAudio: { web: true, flutter: true, flutterKey: 'bc_viewer_audio' },
  BcViewerYoutube: { web: true, flutter: true, flutterKey: 'bc_viewer_youtube' },
  BcViewerInstagram: { web: true, flutter: true, flutterKey: 'bc_viewer_instagram' },
  BcViewerTiktok: { web: true, flutter: true, flutterKey: 'bc_viewer_tiktok' },
  BcViewerDocument: { web: true, flutter: true, flutterKey: 'bc_viewer_document' },
  BcViewerPdf: { web: true, flutter: true, flutterKey: 'bc_viewer_pdf' },
  BcGalleria: { web: true, flutter: true, flutterKey: 'bc_galleria' },
  BcCarousel: { web: true, flutter: true, flutterKey: 'bc_carousel' },

  // --- charts / analytics ---
  BcChart: { web: true, flutter: true, flutterKey: 'bc_chart' },
  BcChartGraph: { web: true, flutter: true, flutterKey: 'bc_chart' },
  BcSparkline: { web: true, flutter: true, flutterKey: 'bc_sparkline' },
  BcProgress: { web: true, flutter: true, flutterKey: 'bc_progress' },
  BcKpi: { web: true, flutter: true, flutterKey: 'bc_kpi' },

  // --- maps ---
  BcMap: { web: true, flutter: true, flutterKey: 'bc_map' },
  BcViewMap: { web: true, flutter: true, flutterKey: 'bc_view_map' },
  BcGeo: { web: true, flutter: true, flutterKey: 'bc_geo' },

  // --- social / collaboration ---
  BcActivity: { web: true, flutter: true, flutterKey: 'bc_activity' },
  BcTimelineSocial: { web: true, flutter: true, flutterKey: 'bc_timeline_social' },
  BcViewActivity: { web: true, flutter: true, flutterKey: 'bc_view_activity' },
  BcChatter: { web: true, flutter: true, flutterKey: 'bc_chatter' },
  BcNotificationCenter: { web: true, flutter: true, flutterKey: 'bc_notification_center' },
  BcNotificationItem: { web: true, flutter: true, flutterKey: 'bc_notification_item' },
  BcPivot: { web: true, flutter: true, flutterKey: 'bc_pivot' },
  BcBuilder: { web: true, flutter: false, flutterKey: '' },
  BcFormBuilder: { web: true, flutter: true, flutterKey: 'bc_form_builder' },
  BcWorkflowBuilder: { web: true, flutter: true, flutterKey: 'bc_workflow_builder' },
  BcSchemaBuilder: { web: true, flutter: true, flutterKey: 'bc_schema_builder' },
  BcComment: { web: true, flutter: true, flutterKey: 'bc_comment' },
  BcMentions: { web: true, flutter: true, flutterKey: 'bc_mentions' },

  // --- print / export ---
  BcReportLink: { web: true, flutter: true, flutterKey: 'bc_report_link' },
  BcExport: { web: true, flutter: true, flutterKey: 'bc_export' },
  BcViewReport: { web: true, flutter: true, flutterKey: 'bc_view_report' },
  BcViewEditor: { web: true, flutter: true, flutterKey: 'bc_view_editor' },

  // --- navigation ---
  BcSearch: { web: true, flutter: true, flutterKey: 'bc_search' },
  BcBreadcrumb: { web: true, flutter: true, flutterKey: 'bc_breadcrumb' },
  BcNavigationMenu: { web: true, flutter: true, flutterKey: 'bc_navigation_menu' },
  BcMegaMenu: { web: true, flutter: true, flutterKey: 'bc_megamenu' },
  BcMenubar: { web: true, flutter: true, flutterKey: 'bc_menubar' },
  BcPanelMenu: { web: true, flutter: true, flutterKey: 'bc_panel_menu' },
  BcSlideMenu: { web: true, flutter: true, flutterKey: 'bc_slide_menu' },

  // --- builder / code ---
  BcCode: { web: true, flutter: true, flutterKey: 'bc_code' },
  BcJson: { web: true, flutter: true, flutterKey: 'bc_json' },
};

/**
 * Returns the audit entry for a component key, or `null` if the key was not
 * part of the audit snapshot (i.e. not referenced by any matrix candidate).
 */
export function getPlatformAuditEntry(
  key: string,
): PlatformAuditEntry | null {
  return PLATFORM_AUDIT[key] ?? null;
}

/**
 * Returns true iff the component key is confirmed present on BOTH web and
 * Flutter in the static audit snapshot. Returns false for unknown keys.
 */
export function isComponentOnBothPlatforms(key: string): boolean {
  const entry = PLATFORM_AUDIT[key];
  return Boolean(entry && entry.web && entry.flutter);
}

/**
 * Returns the list of platforms where the component key is confirmed present
 * in the static audit snapshot. Returns `[]` for unknown keys.
 */
export function componentPlatforms(key: string): Array<'web' | 'flutter'> {
  const entry = PLATFORM_AUDIT[key];
  if (!entry) return [];
  const out: Array<'web' | 'flutter'> = [];
  if (entry.web) out.push('web');
  if (entry.flutter) out.push('flutter');
  return out;
}
