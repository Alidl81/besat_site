"use client";

/* eslint-disable @next/next/no-img-element */

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  CrudSection,
  EmptyState,
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
} from "@/components/crud/crud-ui";
import { PanelIcon } from "@/components/dashboard/panel-icons";
import { PanoramaViewer } from "@/components/virtual-tour/panorama-viewer";
import { TourHotspotEditor } from "@/components/virtual-tour/tour-hotspot-editor";
import { usePanelRequest } from "@/hooks/use-panel-request";
import { getApiErrorMessage } from "@/lib/api/client";
import { getPublicDepartments, getPublicUnits } from "@/services/public-content-service";
import {
  cmsCreateTourScene,
  cmsCreateTourSceneWithProgress,
  cmsDeleteTourScene,
  cmsGetTourScenes,
  cmsRunTourSceneWorkflowAction,
  cmsUpdateTourScene,
  cmsUpdateTourSceneWithProgress,
  type TourSceneWorkflowAction,
} from "@/services/virtual-tour-cms-service";
import type { PublicDepartment, PublicSchoolUnit } from "@/types/public-content";
import type { CMSTourScene, CMSTourSceneWritePayload, TourSceneDetail, TourSceneStatus } from "@/types/virtual-tour";

type ManagerRole = "general_manager" | "unit_manager" | "unit_media";

type VirtualTourManagerProps = {
  unitId?: string | null;
  role: ManagerRole;
};

type DoorGroup = {
  key: string;
  type: "unit" | "department";
  label: string;
  scenes: CMSTourScene[];
};

function buildDoorGroups(scenes: CMSTourScene[], unitId: string | null): DoorGroup[] {
  const filtered = unitId ? scenes.filter((s) => s.unit && String(s.unit.id) === unitId) : scenes;
  const map = new Map<string, DoorGroup>();

  for (const scene of filtered) {
    const key = scene.door_key ?? `scene-${scene.id}`;
    const type: "unit" | "department" = scene.unit ? "unit" : "department";
    const label = scene.unit?.title ?? scene.department?.title ?? "نامشخص";
    if (!map.has(key)) map.set(key, { key, type, label, scenes: [] });
    map.get(key)!.scenes.push(scene);
  }

  for (const group of map.values()) {
    group.scenes.sort((a, b) => a.order - b.order);
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "fa"));
}

const WORKFLOW_ACTIONS: {
  action: TourSceneWorkflowAction;
  label: string;
  from: TourSceneStatus[];
  roles: ManagerRole[];
}[] = [
  { action: "submit-review", label: "ارسال برای بررسی", from: ["draft", "rejected"], roles: ["general_manager", "unit_manager", "unit_media"] },
  { action: "approve", label: "تأیید", from: ["waiting_review"], roles: ["general_manager", "unit_manager"] },
  { action: "reject", label: "رد", from: ["waiting_review", "approved"], roles: ["general_manager", "unit_manager"] },
  { action: "publish", label: "انتشار", from: ["approved"], roles: ["general_manager"] },
  { action: "archive", label: "آرشیو", from: ["draft", "waiting_review", "approved", "published", "rejected"], roles: ["general_manager", "unit_manager"] },
  { action: "restore", label: "بازگردانی به پیش‌نویس", from: ["archived"], roles: ["general_manager", "unit_manager"] },
];

function canEditScene(scene: CMSTourScene, role: ManagerRole) {
  if (role === "general_manager") return true;
  return scene.status !== "approved" && scene.status !== "published";
}

export function VirtualTourManager({ unitId = null, role }: VirtualTourManagerProps) {
  const { data, loading, error, reload } = usePanelRequest(() => cmsGetTourScenes(), []);
  const [editingScene, setEditingScene] = useState<CMSTourScene | "new" | null>(null);
  const [hotspotScene, setHotspotScene] = useState<CMSTourScene | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const doorGroups = useMemo(() => buildDoorGroups(data?.results ?? [], unitId), [data, unitId]);

  async function handleWorkflowAction(scene: CMSTourScene, action: TourSceneWorkflowAction) {
    setBusyId(scene.id);
    setActionError(null);
    try {
      await cmsRunTourSceneWorkflowAction(scene.id, action);
      reload();
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(scene: CMSTourScene) {
    if (!window.confirm(`آیا از حذف صحنه «${scene.title}» مطمئن هستید؟`)) return;
    setBusyId(scene.id);
    setActionError(null);
    try {
      await cmsDeleteTourScene(scene.id);
      reload();
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReorder(group: DoorGroup, index: number, direction: -1 | 1) {
    const neighborIndex = index + direction;
    if (neighborIndex < 0 || neighborIndex >= group.scenes.length) return;
    const current = group.scenes[index];
    const neighbor = group.scenes[neighborIndex];
    setBusyId(current.id);
    setActionError(null);
    try {
      await Promise.all([
        cmsUpdateTourScene(current.id, { order: neighbor.order }),
        cmsUpdateTourScene(neighbor.id, { order: current.order }),
      ]);
      reload();
    } catch (reason) {
      setActionError(getApiErrorMessage(reason));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <CrudSection
      title="تور مجازی"
      description="صحنه‌های پانورامای ۳۶۰ درجه هر واحد و دپارتمان را مدیریت کنید."
      action={
        <PrimaryButton type="button" onClick={() => setEditingScene("new")}>
          <PanelIcon name="plus" className="ml-1.5 inline size-4" />
          صحنه جدید
        </PrimaryButton>
      }
    >
      {actionError ? (
        <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <p className="py-6 text-center text-sm font-bold text-slate-400">در حال بارگذاری…</p>
      ) : error ? (
        <p role="alert" className="py-6 text-center text-sm font-bold text-rose-600">{error}</p>
      ) : doorGroups.length === 0 ? (
        <EmptyState text="هنوز صحنه‌ای برای تور مجازی ثبت نشده است." />
      ) : (
        <div className="space-y-8">
          {doorGroups.map((group) => (
            <div key={group.key} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className={`inline-flex -rotate-1 items-center rounded-full border-[1.5px] px-3 py-0.5 text-xs font-black ${group.type === "unit" ? "border-sky-500 bg-sky-50 text-sky-700" : "border-purple-500 bg-purple-50 text-purple-700"}`}>
                  {group.type === "unit" ? "واحد آموزشی" : "دپارتمان"}
                </span>
                <h3 className="text-base font-black text-[#062452]">{group.label}</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="panel-table w-full">
                  <thead>
                    <tr>
                      <th>پانوراما</th>
                      <th>عنوان</th>
                      <th>وضعیت</th>
                      <th>ترتیب</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.scenes.map((scene, index) => {
                      const availableActions = WORKFLOW_ACTIONS.filter(
                        (item) => item.from.includes(scene.status) && item.roles.includes(role),
                      );
                      const editable = canEditScene(scene, role);
                      return (
                        <tr key={scene.id}>
                          <td>
                            {scene.thumbnail || scene.panorama ? (
                              <img src={scene.thumbnail ?? scene.panorama ?? ""} alt={scene.title} className="size-12 rounded-xl object-cover" />
                            ) : (
                              <div className="size-12 rounded-xl bg-slate-100" />
                            )}
                          </td>
                          <td className="font-black">
                            {scene.title}
                            {scene.is_default ? (
                              <span className="mr-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">پیش‌فرض</span>
                            ) : null}
                            {!scene.is_active ? (
                              <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">غیرفعال</span>
                            ) : null}
                          </td>
                          <td><StatusBadge status={scene.status} /></td>
                          <td>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={!editable || busyId === scene.id || index === 0}
                                onClick={() => handleReorder(group, index, -1)}
                                className="panel-icon-button disabled:opacity-30"
                                aria-label="جابه‌جایی به بالا"
                              >
                                <PanelIcon name="chevron" className="size-4 rotate-90" />
                              </button>
                              <button
                                type="button"
                                disabled={!editable || busyId === scene.id || index === group.scenes.length - 1}
                                onClick={() => handleReorder(group, index, 1)}
                                className="panel-icon-button disabled:opacity-30"
                                aria-label="جابه‌جایی به پایین"
                              >
                                <PanelIcon name="chevron" className="size-4 -rotate-90" />
                              </button>
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              {availableActions.map((item) => (
                                <button
                                  key={item.action}
                                  type="button"
                                  disabled={busyId === scene.id}
                                  onClick={() => handleWorkflowAction(scene, item.action)}
                                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {item.label}
                                </button>
                              ))}
                              <button
                                type="button"
                                disabled={group.scenes.length < 2}
                                onClick={() => setHotspotScene(scene)}
                                className="panel-icon-button disabled:opacity-30"
                                aria-label={`نقاط اتصال ${scene.title}`}
                                title={group.scenes.length < 2 ? "برای افزودن نقطه اتصال به حداقل ۲ صحنه در این در نیاز است." : "نقاط اتصال"}
                              >
                                <PanelIcon name="link" className="size-4" />
                              </button>
                              {editable ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingScene(scene)}
                                  className="panel-icon-button"
                                  aria-label={`ویرایش ${scene.title}`}
                                >
                                  <PanelIcon name="edit" className="size-4" />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleDelete(scene)}
                                disabled={busyId === scene.id}
                                className="panel-icon-button hover:bg-rose-50 hover:text-rose-600"
                                aria-label={`حذف ${scene.title}`}
                              >
                                <PanelIcon name="trash" className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editingScene !== null}
        onClose={() => setEditingScene(null)}
        title={editingScene === "new" ? "صحنه جدید" : "ویرایش صحنه"}
        size="xl"
      >
        {editingScene !== null ? (
          <TourSceneForm
            scene={editingScene === "new" ? null : editingScene}
            unitId={unitId}
            onCancel={() => setEditingScene(null)}
            onSaved={() => {
              setEditingScene(null);
              reload();
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={hotspotScene !== null}
        onClose={() => setHotspotScene(null)}
        title={hotspotScene ? `نقاط اتصال «${hotspotScene.title}»` : "نقاط اتصال"}
        size="xl"
      >
        {hotspotScene ? (
          <TourHotspotEditor
            scene={hotspotScene}
            doorScenes={doorGroups.find((g) => g.key === hotspotScene.door_key)?.scenes ?? [hotspotScene]}
            onClose={() => setHotspotScene(null)}
          />
        ) : null}
      </Modal>
    </CrudSection>
  );
}

function TourSceneForm({
  scene,
  unitId,
  onCancel,
  onSaved,
}: {
  scene: CMSTourScene | null;
  unitId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(scene?.title ?? "");
  const [description, setDescription] = useState(scene?.description ?? "");
  const [doorType, setDoorType] = useState<"unit" | "department">(scene?.department ? "department" : "unit");
  const [selectedUnitId, setSelectedUnitId] = useState<string>(scene?.unit ? String(scene.unit.id) : unitId ?? "");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(scene?.department ? String(scene.department.id) : "");
  const [units, setUnits] = useState<PublicSchoolUnit[]>([]);
  const [departments, setDepartments] = useState<PublicDepartment[]>([]);

  const [panoramaFile, setPanoramaFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const [initialYaw, setInitialYaw] = useState(scene?.initial_yaw ?? 0);
  const [initialPitch, setInitialPitch] = useState(scene?.initial_pitch ?? 0);
  const [initialHfov, setInitialHfov] = useState(scene?.initial_hfov ?? 105);
  const [previewAngles, setPreviewAngles] = useState({ yaw: initialYaw, pitch: initialPitch, hfov: initialHfov });

  const [isDefault, setIsDefault] = useState(scene?.is_default ?? false);
  const [isActive, setIsActive] = useState(scene?.is_active ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDoorLocked = Boolean(scene) || unitId !== null;

  useEffect(() => {
    if (isDoorLocked) return;
    Promise.all([getPublicUnits(), getPublicDepartments()])
      .then(([unitList, departmentList]) => {
        setUnits(unitList);
        setDepartments(departmentList);
      })
      .catch(() => undefined);
  }, [isDoorLocked]);

  const panoramaObjectUrl = useMemo(
    () => (panoramaFile ? URL.createObjectURL(panoramaFile) : null),
    [panoramaFile],
  );
  useEffect(() => {
    return () => {
      if (panoramaObjectUrl) URL.revokeObjectURL(panoramaObjectUrl);
    };
  }, [panoramaObjectUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewAngles({ yaw: initialYaw, pitch: initialPitch, hfov: initialHfov });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [initialYaw, initialPitch, initialHfov]);

  const previewUrl = panoramaObjectUrl ?? scene?.panorama ?? null;
  const previewScene = useMemo<TourSceneDetail | null>(() => {
    if (!previewUrl) return null;
    return {
      id: -1,
      title: title || "پیش‌نمایش",
      slug: "preview",
      description: null,
      panorama: previewUrl,
      thumbnail: null,
      unit: null,
      department: null,
      door_key: null,
      initial_yaw: previewAngles.yaw,
      initial_pitch: previewAngles.pitch,
      initial_hfov: previewAngles.hfov,
      is_default: false,
      status: "draft",
      is_published: false,
      is_active: true,
      order: 0,
      hotspots: [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, previewAngles]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setProgress(null);

    const payload: CMSTourSceneWritePayload = {
      title,
      description: description || null,
      initial_yaw: initialYaw,
      initial_pitch: initialPitch,
      initial_hfov: initialHfov,
      is_default: isDefault,
      is_active: isActive,
    };

    if (!isDoorLocked) {
      if (doorType === "unit") {
        payload.unit = selectedUnitId ? Number(selectedUnitId) : null;
        payload.department = null;
      } else {
        payload.department = selectedDepartmentId ? Number(selectedDepartmentId) : null;
        payload.unit = null;
      }
    }

    if (panoramaFile) payload.panorama = panoramaFile;
    if (thumbnailFile) payload.thumbnail = thumbnailFile;

    const hasUpload = Boolean(panoramaFile || thumbnailFile);

    try {
      if (scene) {
        if (hasUpload) {
          await cmsUpdateTourSceneWithProgress(scene.id, payload, setProgress);
        } else {
          await cmsUpdateTourScene(scene.id, payload);
        }
      } else {
        if (hasUpload) {
          await cmsCreateTourSceneWithProgress(payload, setProgress);
        } else {
          await cmsCreateTourScene(payload);
        }
      }
      onSaved();
    } catch (reason) {
      setError(getApiErrorMessage(reason));
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  const needsDoorSelection = !isDoorLocked && (
    (doorType === "unit" && !selectedUnitId) || (doorType === "department" && !selectedDepartmentId)
  );

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <Field label="عنوان صحنه" required>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>

      <Field label="توضیحات">
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>

      {!isDoorLocked ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="نوع در">
            <Select value={doorType} onChange={(e) => setDoorType(e.target.value as "unit" | "department")}>
              <option value="unit">واحد آموزشی</option>
              <option value="department">دپارتمان</option>
            </Select>
          </Field>
          {doorType === "unit" ? (
            <Field label="واحد آموزشی" required>
              <Select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)} required>
                <option value="">انتخاب واحد</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.title}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="دپارتمان" required>
              <Select value={selectedDepartmentId} onChange={(e) => setSelectedDepartmentId(e.target.value)} required>
                <option value="">انتخاب دپارتمان</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.title}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="تصویر پانورامای ۳۶۰ درجه">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPanoramaFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm font-bold text-slate-500 file:ml-3 file:rounded-xl file:border-0 file:bg-[#12395b] file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
            />
            <p className="mt-1 text-xs font-bold text-slate-400">فرمت JPG، PNG یا WebP — حداکثر ۲۰ مگابایت.</p>
          </Field>

          <Field label="تصویر بندانگشتی (اختیاری)">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm font-bold text-slate-500 file:ml-3 file:rounded-xl file:border-0 file:bg-slate-600 file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
            />
          </Field>

          {progress !== null ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#12395b] transition-all" style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            <Field label="زاویه افقی (Yaw)">
              <TextInput type="number" value={initialYaw} onChange={(e) => setInitialYaw(Number(e.target.value))} />
            </Field>
            <Field label="زاویه عمودی (Pitch)">
              <TextInput type="number" value={initialPitch} onChange={(e) => setInitialPitch(Number(e.target.value))} />
            </Field>
            <Field label="زاویه دید (HFOV)">
              <TextInput type="number" value={initialHfov} onChange={(e) => setInitialHfov(Number(e.target.value))} />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <span className="text-sm font-black text-[#062452]">صحنه پیش‌فرض این در</span>
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="size-5 rounded border-slate-300 accent-blue-600" />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <span className="text-sm font-black text-[#062452]">فعال</span>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-5 rounded border-slate-300 accent-blue-600" />
            </label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-[#062452]">پیش‌نمایش زنده</p>
          {previewScene ? (
            <div className="h-64 overflow-hidden rounded-2xl lg:h-full lg:min-h-[320px]">
              <PanoramaViewer scenes={[previewScene]} title={previewScene.title} />
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400 lg:h-full lg:min-h-[320px]">
              پس از انتخاب تصویر پانوراما، پیش‌نمایش اینجا نمایش داده می‌شود.
            </div>
          )}
        </div>
      </div>

      {error ? <p role="alert" className="text-sm font-black text-rose-600">{error}</p> : null}

      <div className="flex gap-3">
        <PrimaryButton type="submit" disabled={submitting || needsDoorSelection}>
          {submitting ? "در حال ذخیره…" : "ذخیره"}
        </PrimaryButton>
        <GhostButton type="button" onClick={onCancel}>انصراف</GhostButton>
      </div>
    </form>
  );
}
