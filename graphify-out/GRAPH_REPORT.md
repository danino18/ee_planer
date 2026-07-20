# Graph Report - .  (2026-07-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2141 nodes · 4247 edges · 144 communities (119 shown, 25 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 102 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1d239f9a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 139
- Community 142
- Community 143

## God Nodes (most connected - your core abstractions)
1. `SapCourse` - 57 edges
2. `TailwindConfigGenerator` - 54 edges
3. `computeRequirementsProgress()` - 41 edges
4. `TrackDefinition` - 38 edges
5. `usePlanStore` - 36 edges
6. `TestTailwindConfigGenerator` - 35 edges
7. `ShadcnInstaller` - 32 edges
8. `bareId()` - 31 edges
9. `TestShadcnInstaller` - 26 edges
10. `buildCourseAssignments()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `DegreeCompletionModal()` --indirect_call--> `rec()`  [INFERRED]
  src/components/DegreeCompletionModal.tsx → tests/gradeStatisticsSelect.test.mjs
- `PrintPlanSection()` --indirect_call--> `course()`  [INFERRED]
  src/components/PrintView.tsx → tests/electiveClassification.test.mjs
- `SpecializationGroupModal()` --indirect_call--> `course()`  [INFERRED]
  src/components/SpecializationGroupModal.tsx → tests/electiveClassification.test.mjs
- `calculateRequirement()` --indirect_call--> `course()`  [INFERRED]
  src/domain/generalRequirements/rulesEngine.ts → tests/electiveClassification.test.mjs
- `sortCourses()` --indirect_call--> `course()`  [INFERRED]
  src/domain/gradeStatistics/filters.ts → tests/electiveClassification.test.mjs

## Import Cycles
- None detected.

## Communities (144 total, 25 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (32): main(), Path, Add all available shadcn/ui components.          Args:             overwrite: If, List installed components.          Returns:             Tuple of (success, mess, Handle shadcn/ui component installation., Initialize installer.          Args:             project_root: Project root dire, Check if shadcn is initialized in project.          Returns:             True if, Get list of already installed components.          Returns:             List of (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (47): EXTERNAL_FACULTY_ELECTIVE_COURSES, ExternalFacultyElectiveCourse, externalFacultyElectiveCourseById, getExternalFacultyElectiveCourse(), buildReverseGraph(), DownstreamDependents, DownstreamIndirectEntry, getDownstreamDependents() (+39 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (40): ceTrack, csTrack, eeCombinedTrack, eeTrack, eeMathTrack, eePhysicsTrack, TRACK_MAP, sanitizeTrackSpecializationSelections() (+32 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (42): BM25, detect_domain(), get_cip_brief(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection (+34 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (42): applyAlias(), buildOptions(), buildSuggestions(), CheeseForkInfo(), EMPTY_ALIASES, EMPTY_DISMISSED, EMPTY_SUGGESTIONS, FilterChipProps (+34 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (39): CompactRequirementRow(), CompactRequirementRowProps, ElectiveBreakdown(), ElectiveBreakdownProps, formatCredits(), formatRequirementValue(), GeneralElectivesRow(), GeneralElectivesRowProps (+31 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (34): discoverHistoricalFiles(), fetchHistoricalSemester(), loadCurrentCourseIds(), SEMESTERS, isMissing(), mergeSemesters(), valuesDiffer(), convertCourseNumber() (+26 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (35): clampGrade(), CourseFilterPanel(), FILTER_LINKS, GradeStatsChip(), Props, RATING_FILTER_OPTIONS, SORT_OPTIONS, TOGGLE_FILTERS (+27 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (38): CHOIR_ORCHESTRA_COURSE_IDS, isAdvancedDegreeCourseId(), isChoirOrOrchestraCourseId(), isCourseCountedAsMelag(), isCourseIdInInclusiveRange(), isCourseTaughtInEnglish(), isFreeElectiveCourseId(), isHumanitiesFreeElectiveCourseId() (+30 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (36): format_context(), format_result(), main(), Format a single search result for display, Format contextual recommendations for display., BM25, calculate_pattern_break(), detect_domain() (+28 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (31): Props, SEM_LABELS, UNIT_LABELS, computeDegreeCompletionCheck(), buildRequirementChecks(), deriveStatus(), idsForBuckets(), buildAllPlaced() (+23 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (36): getSatisfiedAlternativeCourseId(), getVisibleMandatoryCourseIds(), isTechnicalEnglishAdvancedB(), shouldHideRecommendedCourse(), CE_CS_PROJECT_PREFIXES, CeProjectRequirementProfile, getCeProjectRequirementProfile(), isCeCsProjectCourse() (+28 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (26): BucketCourse, BucketView, BucketViewProps, CourseCard, LazyCourseDetailModal, Props, Props, PrintCourseRow() (+18 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (37): applySpecializationGroupYearVariant(), buildGroupCourseList(), buildGroupLegacyLists(), buildReplacementAliasMap(), buildTrackCatalog(), ChoiceRuleEvaluation, collectRuleCourseNumbers(), collectRuleOptions() (+29 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (34): $type, $value, $type, $value, $type, $value, $type, $value (+26 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (30): formatSemesterLabel(), PrintPlanSection(), seasonLabel(), SectionProps, SEM_LABELS, VersionColumn(), computeNoAdditionalCreditConflicts(), getNoAdditionalCreditCourseIds() (+22 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (24): loadTsModule(), repoRoot, resolveTypeScriptModule(), transpiledModuleUrls, transpileToDataUrl(), discoverCourseNumbers(), fetchCourseJson(), fetchText() (+16 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (25): ALL_TRACKS, AppInner(), PlannerApp(), ChainRecommendations(), DegreeCompletionModal(), DegreePlanningMenu(), MENU_ITEMS, Props (+17 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (25): ShareUpdatesPanelProps, Tab, VersionScope, ShareLoadState, ShareModeWrapper(), ShareModeContext, ShareModeContextValue, buildExportFilename() (+17 more)

### Community 19 - "Community 19"
Cohesion: 0.21
Nodes (28): ALLOWED_TOP_LEVEL_KEYS, ELECTIVE_CREDIT_AREAS, fail(), isFiniteNumber(), isIntegerInRange(), isNonEmptyString(), isPlainObject(), isTrackId() (+20 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (24): get_context(), is_allowed_exception(), is_allowed_rgba(), is_inside_block(), load_css_variables(), main(), print_result(), print_summary() (+16 more)

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (23): GradeSheetModal(), Props, SubmitState, expandCourseIdVariants(), normalizeCourseIdKey(), normalizeCourseNumberStrict(), StrictNormalizeResult, toSapEightDigitCourseIdForStorage() (+15 more)

### Community 22 - "Community 22"
Cohesion: 0.07
Nodes (26): express, firebase-admin, firebase-functions, dependencies, express, firebase-admin, firebase-functions, devDependencies (+18 more)

### Community 23 - "Community 23"
Cohesion: 0.07
Nodes (26): DOM, DOM.Iterable, vite/client, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib (+18 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (19): BM25, detect_domain(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection, Search across all domains and combine results (+11 more)

### Community 25 - "Community 25"
Cohesion: 0.07
Nodes (14): Test adding full color palette., Test adding custom fonts., Test TailwindConfigGenerator class., Test that adding same plugin twice doesn't duplicate., Test plugin recommendations., Test plugin recommendations for Next.js., Test generating JavaScript configuration., Test initialization for JavaScript config. (+6 more)

### Community 26 - "Community 26"
Cohesion: 0.16
Nodes (21): Props, Props, CourseRowProps, Props, Props, Props, Props, VersionColumnProps (+13 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (23): $type, $value, sm, $type, $value, $type, $value, $type (+15 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (22): node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection (+14 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (18): CourseDetailModal(), Props, SpecializationGroupModal(), summarizeBlock(), getRuleProgress(), LazySpecializationGroupModal, SpecializationPanel(), summarizeRuleBlock() (+10 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (18): GENERAL_REQUIREMENTS_RULES, DegreeProgressShape, allocateGeneralElectives(), AllocatorInput, Bucket, pourInto(), matchCourse(), calculateGeneralRequirements() (+10 more)

### Community 31 - "Community 31"
Cohesion: 0.24
Nodes (21): ALLOWED_TOP_LEVEL_KEYS, ELECTIVE_CREDIT_AREAS, isFiniteNumber(), isIntegerInRange(), isPlainObject(), isTrackId(), sanitizeEnvelope(), sanitizeStudentPlan() (+13 more)

### Community 32 - "Community 32"
Cohesion: 0.10
Nodes (21): eslint, @eslint/js, eslint-plugin-react-hooks, globals, devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks (+13 more)

### Community 33 - "Community 33"
Cohesion: 0.17
Nodes (17): CATEGORY_LABELS, CourseGradeStats(), formatGrade(), Props, computeGeneralStatistic(), latest(), mean(), meanInt() (+9 more)

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (20): $type, $value, $type, $value, $type, $value, $type, $value (+12 more)

### Community 35 - "Community 35"
Cohesion: 0.19
Nodes (17): TRACK_ICONS, TrackSelector(), getAllScheduledCourseIds(), getAllSemesterEntryCourseIds(), getAvailableYears(), resolveTrackForYear(), addCourseReference(), collectMissingStaticCourseReferences() (+9 more)

### Community 36 - "Community 36"
Cohesion: 0.11
Nodes (19): $type, $value, $type, $value, $type, $value, $type, $value (+11 more)

### Community 37 - "Community 37"
Cohesion: 0.11
Nodes (19): $type, $value, background, destructive, foreground, muted-foreground, primary-hover, secondary (+11 more)

### Community 38 - "Community 38"
Cohesion: 0.19
Nodes (13): optionalAuth(), OptionalAuthRequest, parseExpiresAt(), VALID_TTL_MS, createShare(), db(), generateShareId(), getShare() (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.14
Nodes (13): LoginButton(), LoginButtonProps, SYNC_COLOR, SYNC_LABEL, ShareErrorScreen(), AuthContext, AuthContextType, AuthProvider() (+5 more)

### Community 40 - "Community 40"
Cohesion: 0.18
Nodes (12): CE_SPECIALIZATION_YEAR_VARIANTS, CS_SPECIALIZATION_YEAR_VARIANTS, EE_COMBINED_SPECIALIZATION_YEAR_VARIANTS, EE_MATH_SPECIALIZATION_YEAR_VARIANTS, EE_PHYSICS_SPECIALIZATION_YEAR_VARIANTS, EE_SPECIALIZATION_YEAR_VARIANTS, REPORTED_TRACKS, reportTrackSpecializationDiagnostics() (+4 more)

### Community 41 - "Community 41"
Cohesion: 0.17
Nodes (17): generate_css_for_background(), get_background_image(), get_curated_images(), get_overlay_css(), get_pexels_search_url(), load_backgrounds_config(), load_brand_colors(), main() (+9 more)

### Community 42 - "Community 42"
Cohesion: 0.11
Nodes (9): main(), Add custom font families.          Args:             fonts: Dict of font_type: [, Add custom spacing values.          Args:             spacing: Dict of name: val, Add custom breakpoints.          Args:             breakpoints: Dict of name: wi, Add plugin requirements.          Args:             plugins: List of plugin name, Get plugin recommendations based on configuration.          Returns:, Validate configuration.          Returns:             Tuple of (valid, message), Add custom colors to theme.          Args:             colors: Dict of color_nam (+1 more)

### Community 43 - "Community 43"
Cohesion: 0.12
Nodes (9): Generate Tailwind CSS configuration files., Add full color palette (50-950 shades) for a base color.          Args:, TailwindConfigGenerator, Test initialization with default settings., Test generating config with custom colors., Test generating config with plugins., Test validating valid configuration., Test generating complete TypeScript configuration. (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.12
Nodes (17): SemesterScheduleAlternativeGroup, SemesterScheduleEntry, SpecializationCatalogSelectionState, SpecializationChoiceRule, SpecializationCourseOption, SpecializationCourseReference, SpecializationDiagnostic, SpecializationGroupEvaluation (+9 more)

### Community 45 - "Community 45"
Cohesion: 0.20
Nodes (12): $type, $value, bg, bg, padding, shadow, card, bg (+4 more)

### Community 46 - "Community 46"
Cohesion: 0.17
Nodes (16): ansi_ljust(), format_ascii_box(), format_markdown(), format_master_md(), generate_design_system(), hex_to_ansi(), persist_design_system(), Convert hex color to ANSI True Color swatch (██) with fallback. (+8 more)

### Community 47 - "Community 47"
Cohesion: 0.16
Nodes (9): DesignSystemGenerator, Select best matching result based on priority keywords., Extract results list from search result dict., Generate complete design system recommendation., Generates design system recommendations from aggregated searches., Load reasoning rules from CSV., Execute searches across multiple domains., Find matching reasoning rule for a category. (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.12
Nodes (17): @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, firebase, dependencies, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities (+9 more)

### Community 49 - "Community 49"
Cohesion: 0.27
Nodes (12): requireAdmin(), AuthRequest, verifyAuth(), db(), deletePlan(), deleteUser(), getPlan(), getStats() (+4 more)

### Community 50 - "Community 50"
Cohesion: 0.20
Nodes (15): apply_color(), apply_viewbox_size(), extract_svgs(), generate_batch(), generate_icon(), generate_sizes(), load_env(), main() (+7 more)

### Community 51 - "Community 51"
Cohesion: 0.13
Nodes (13): generate_chart_slide(), generate_deck(), generate_metrics_slide(), generate_problem_slide(), generate_solution_slide(), generate_title_slide(), main(), Title slide with gradient headline (+5 more)

### Community 52 - "Community 52"
Cohesion: 0.15
Nodes (11): csControlRoboticsGroup, csMachineLearningGroup, EE_LAB_IDS, emptyCatalog, loadTranspiledModule(), makeChoiceRule(), makeSpecializationGroup(), repoRoot (+3 more)

### Community 53 - "Community 53"
Cohesion: 0.20
Nodes (15): $type, $value, 500, blue, green, red, white, yellow (+7 more)

### Community 54 - "Community 54"
Cohesion: 0.15
Nodes (12): api, apiRouter, app, adminRouter, aiRouter, plansRouter, sharesRouter, securityHeadersMiddleware() (+4 more)

### Community 55 - "Community 55"
Cohesion: 0.21
Nodes (14): appendVaryHeader(), corsMiddleware(), createRateLimitMiddleware(), getProjectId(), getRequesterKey(), isAllowedOrigin(), LOCAL_DEV_ORIGINS, normalizeOrigin() (+6 more)

### Community 56 - "Community 56"
Cohesion: 0.13
Nodes (14): compileOnSave, compilerOptions, esModuleInterop, module, noImplicitReturns, noUnusedLocals, outDir, resolveJsonModule (+6 more)

### Community 57 - "Community 57"
Cohesion: 0.13
Nodes (15): scripts, analyze:bundle, build, build:functions, check, dev, lint, lint:functions (+7 more)

### Community 58 - "Community 58"
Cohesion: 0.18
Nodes (12): isEnglishCourseId(), historicalFallbackCourses, FallbackTeachingSemester, fallbackTeachingSemesterByCourseId, TeachingSemesterFallbackCourse, teachingSemesterFallbackCourses, addPrerequisiteOption(), fetchCourses() (+4 more)

### Community 59 - "Community 59"
Cohesion: 0.22
Nodes (13): buildIndex(), collectSemesters(), GradeStatisticsIndex, ParseWarning, GradeCategory, buildData(), datasetUrl(), GradeStatisticsData (+5 more)

### Community 60 - "Community 60"
Cohesion: 0.22
Nodes (11): calculateCompliance(), colorDistance(), displayPalette(), extractHexColors(), findNearestBrandColor(), fs, generateImageMagickCommand(), hexToRgb() (+3 more)

### Community 61 - "Community 61"
Cohesion: 0.25
Nodes (13): checkManifest(), formatBytes(), formatOutput(), fs, main(), parseFilename(), path, RULES (+5 more)

### Community 62 - "Community 62"
Cohesion: 0.29
Nodes (13): blend(), derive_row(), derive_ui_reasoning(), h2r(), is_dark(), lum(), on_color(), r2h() (+5 more)

### Community 63 - "Community 63"
Cohesion: 0.25
Nodes (11): BUDGET, budgetCheck, DIST_DIR, metrics, report, collectBundleMetrics(), evaluateBundleBudget(), formatBundleReport() (+3 more)

### Community 64 - "Community 64"
Cohesion: 0.23
Nodes (13): buildOutput(), extractCourseIds(), extractVisibleText(), fetchHtml(), hasGeneratedFallback(), HUMANITIES_FREE_ELECTIVE_COURSES, main(), pickRelevantText() (+5 more)

### Community 65 - "Community 65"
Cohesion: 0.15
Nodes (12): component, $type, $value, dark, semantic, $schema, $type, $value (+4 more)

### Community 66 - "Community 66"
Cohesion: 0.21
Nodes (11): Document, MCP Server — חיפוש סמנטי ב-Pinecone index "ee", מחפש מידע בתוכנית הלימודים של הפקולטה להנדסת חשמל ומחשבים (תשפ"ו).     השתמש בכל, search_ee_pdf(), Pinecone, embed_and_upsert(), extract_chunk_text(), main() (+3 more)

### Community 67 - "Community 67"
Cohesion: 0.28
Nodes (11): HistogramParseResult, parseCourseHistogram(), parseCourseSemester(), parseGradeValue(), parsePassPercent(), parseStudents(), PLACEHOLDERS, rawToNumber() (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.24
Nodes (11): extensions, formatReport(), fs, getFiles(), main(), parseArgs(), path, patterns (+3 more)

### Community 69 - "Community 69"
Cohesion: 0.20
Nodes (6): Generate configuration file content.          Returns:             Configuration, Generate TypeScript configuration., Generate JavaScript configuration., Format plugins array for config., Add indentation to JSON string., Write configuration to file.          Returns:             Tuple of (success, me

### Community 70 - "Community 70"
Cohesion: 0.29
Nodes (10): apiClient, ApiRequestError, getBaseUrls(), getIdToken(), getOptionalIdToken(), isCloudRunServiceUrl(), normalizeBaseUrl(), request() (+2 more)

### Community 71 - "Community 71"
Cohesion: 0.21
Nodes (10): FirestoreLikeError, isRetryableSyncError(), savePlanToCloud(), stripUndefined(), subscribeToCloudPlan(), wrapPlanAsEnvelope(), app, auth (+2 more)

### Community 72 - "Community 72"
Cohesion: 0.31
Nodes (10): extractColorsFromTable(), extractCoreAttributes(), extractHexColors(), extractImageStyle(), extractTypography(), extractVoice(), fs, generatePromptAddition() (+2 more)

### Community 73 - "Community 73"
Cohesion: 0.20
Nodes (9): args, extractTokens(), fs, minimal, MINIMAL_TOKENS, path, projectRoot, tokensPath (+1 more)

### Community 74 - "Community 74"
Cohesion: 0.25
Nodes (10): detect_domain(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection, Search stack-specific guidelines, search() (+2 more)

### Community 75 - "Community 75"
Cohesion: 0.29
Nodes (9): extractEnvelope(), buildExportEnvelope(), stripGradesFromPlan(), cloneSemesterMap(), cloneStringArrayMap(), serializePlanState(), buildEnvelopeFromState(), BuildEnvelopeOptions (+1 more)

### Community 76 - "Community 76"
Cohesion: 0.29
Nodes (9): enhance_prompt(), generate_batch(), generate_logo(), load_env(), main(), Enhance the logo prompt with style and industry modifiers, Generate a logo using Gemini models with image generation      Args:         asp, Generate multiple logo variants with different styles (+1 more)

### Community 77 - "Community 77"
Cohesion: 0.36
Nodes (9): flattenTokens(), fs, generateCSS(), generateTailwind(), main(), parseArgs(), path, resolveReference() (+1 more)

### Community 78 - "Community 78"
Cohesion: 0.53
Nodes (6): $type, $value, 600, 600, 600, 600

### Community 79 - "Community 79"
Cohesion: 0.20
Nodes (10): fg, font-size, hover-bg, button, $type, $value, $type, $value (+2 more)

### Community 80 - "Community 80"
Cohesion: 0.20
Nodes (10): fast, normal, slow, $type, $value, $type, $value, duration (+2 more)

### Community 81 - "Community 81"
Cohesion: 0.22
Nodes (6): Path, Initialize generator.          Args:             typescript: If True, generate ., Determine default output path., Create base configuration structure., Get default content paths for framework., Any

### Community 82 - "Community 82"
Cohesion: 0.27
Nodes (8): collisionDetection, createCollisionArgs(), createDroppableContainer(), loadTranspiledModule(), repoRoot, resolveTypeScriptModule(), transpiledModuleUrls, transpileToDataUrl()

### Community 83 - "Community 83"
Cohesion: 0.33
Nodes (8): adjustBrightness(), { execSync }, extractColorsFromMarkdown(), fs, generateColorScale(), main(), path, updateDesignTokens()

### Community 84 - "Community 84"
Cohesion: 0.28
Nodes (5): BM25, BM25 ranking algorithm for text search, Lowercase, split, remove punctuation, filter short words, Build BM25 index from documents, Score all documents against query

### Community 85 - "Community 85"
Cohesion: 0.28
Nodes (6): loadTranspiledModule(), mandatoryIds, repoRoot, resolveTypeScriptModule(), transpiledModuleUrls, transpileToDataUrl()

### Community 86 - "Community 86"
Cohesion: 0.33
Nodes (8): createEnvelope(), createPlan(), loadPlanSyncModule(), loadSerializerModule(), localEnvelopeForSignatureCheck(), repoRoot, serializerModuleUrl, transpileToModuleUrl()

### Community 87 - "Community 87"
Cohesion: 0.29
Nodes (8): padding-y, input, $type, $value, focus-ring, padding-y, $type, $value

### Community 88 - "Community 88"
Cohesion: 0.32
Nodes (6): baseAllocation, loadModule(), repoRoot, resolveTypeScriptModule(), transpiledModuleUrls, transpileToDataUrl()

### Community 89 - "Community 89"
Cohesion: 0.32
Nodes (5): loadTranspiledModule(), repoRoot, resolveTypeScriptModule(), transpiledModuleUrls, transpileToDataUrl()

### Community 90 - "Community 90"
Cohesion: 0.25
Nodes (5): enginePath, engineSource, filesRoot, repoRoot, TRACK_SPECIALIZATION_FOLDERS

### Community 91 - "Community 91"
Cohesion: 0.38
Nodes (6): CollisionAlgorithm, CollisionAlgorithms, CollisionDetectionArgs, createSemesterGridCollisionDetection(), filterDroppableContainers(), runCollisionAlgorithm()

### Community 92 - "Community 92"
Cohesion: 0.38
Nodes (5): loadTranspiledModule(), repoRoot, resolveTypeScriptModule(), transpiledModuleUrls, transpileToDataUrl()

### Community 93 - "Community 93"
Cohesion: 0.38
Nodes (5): loadModule(), repoRoot, resolveTypeScriptModule(), transpiledModuleUrls, transpileToDataUrl()

### Community 94 - "Community 94"
Cohesion: 0.33
Nodes (6): _detect_page_type(), format_page_override_md(), _generate_intelligent_overrides(), Detect page type from context and search results., Format a page-specific override file with intelligent AI-generated content., Generate intelligent overrides based on page type using layered search.

### Community 96 - "Community 96"
Cohesion: 0.47
Nodes (5): loadTranspiledModule(), repoRoot, resolveTypeScriptModule(), transpiledModuleUrls, transpileToDataUrl()

### Community 97 - "Community 97"
Cohesion: 0.47
Nodes (5): loadTranspiledModule(), repoRoot, resolveTypeScriptModule(), transpiledModuleUrls, transpileToDataUrl()

### Community 98 - "Community 98"
Cohesion: 0.47
Nodes (5): loadTranspiledModule(), repoRoot, resolveTypeScriptModule(), transpiledModuleUrls, transpileToDataUrl()

### Community 99 - "Community 99"
Cohesion: 0.47
Nodes (5): loadTranspiledModule(), repoRoot, resolveTypeScriptModule(), transpiledModuleUrls, transpileToDataUrl()

### Community 100 - "Community 100"
Cohesion: 0.60
Nodes (5): $type, $value, 700, 700, 700

### Community 101 - "Community 101"
Cohesion: 0.60
Nodes (5): radius, radius, radius, $type, $value

### Community 102 - "Community 102"
Cohesion: 0.60
Nodes (5): lg, $type, $value, lg, lg

### Community 103 - "Community 103"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 104 - "Community 104"
Cohesion: 0.50
Nodes (3): createEnvelopePayload(), createPlanPayload(), repoRoot

### Community 105 - "Community 105"
Cohesion: 0.40
Nodes (4): appSource, repoRoot, storeSource, wrapperSource

### Community 107 - "Community 107"
Cohesion: 0.67
Nodes (4): $type, $value, 800, 800

### Community 108 - "Community 108"
Cohesion: 0.60
Nodes (5): $type, $value, border, border, border

### Community 109 - "Community 109"
Cohesion: 0.67
Nodes (3): quotePowerShellArg(), runStep(), steps

### Community 112 - "Community 112"
Cohesion: 0.67
Nodes (4): $type, $value, 50, 50

### Community 113 - "Community 113"
Cohesion: 0.67
Nodes (4): padding-x, padding-x, $type, $value

### Community 114 - "Community 114"
Cohesion: 0.67
Nodes (3): destructive-foreground, $type, $value

### Community 115 - "Community 115"
Cohesion: 0.67
Nodes (3): primary, $type, $value

### Community 116 - "Community 116"
Cohesion: 0.67
Nodes (3): muted, $type, $value

### Community 117 - "Community 117"
Cohesion: 0.67
Nodes (3): ring, $type, $value

### Community 118 - "Community 118"
Cohesion: 0.67
Nodes (3): primary-foreground, $type, $value

### Community 123 - "Community 123"
Cohesion: 0.67
Nodes (3): secondary-foreground, $type, $value

## Knowledge Gaps
- **478 isolated node(s):** `fs`, `path`, `fs`, `path`, `fs` (+473 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `course()` connect `Community 6` to `Community 1`, `Community 7`, `Community 13`, `Community 15`, `Community 58`, `Community 29`, `Community 30`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `SapCourse` connect `Community 26` to `Community 1`, `Community 35`, `Community 5`, `Community 7`, `Community 8`, `Community 10`, `Community 11`, `Community 12`, `Community 44`, `Community 15`, `Community 17`, `Community 18`, `Community 58`, `Community 29`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `primitive` connect `Community 27` to `Community 65`, `Community 34`, `Community 14`, `Community 80`, `Community 53`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 33 inferred relationships involving `TailwindConfigGenerator` (e.g. with `TestTailwindConfigGenerator` and `.test_add_breakpoints()`) actually correct?**
  _`TailwindConfigGenerator` has 33 INFERRED edges - model-reasoned connections that need verification._
- **What connects `fs`, `path`, `fs` to the rest of the system?**
  _478 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05069124423963134 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05380852550663871 - nodes in this community are weakly interconnected._