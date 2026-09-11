import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CircularSelector, type CircularItem } from "@/components/circular/circular-selector";

afterEach(() => {
  cleanup();
});

const departments: CircularItem[] = [
  { id: "education", slug: "education", title: "معاونت آموزش و برنامه‌ریزی نوین" },
  { id: "research", slug: "research", title: "مرکز پژوهش و فناوری آموزشی" },
  { id: "culture", slug: "culture", title: "معاونت فرهنگی و پرورشی" },
  { id: "support", slug: "support", title: "مرکز پشتیبانی و رفاه دانش‌آموزی" },
  { id: "management", slug: "management", title: "مدیریت و ارتباط با خانواده‌ها" },
];

describe("CircularSelector", () => {
  it("renders one shared orbital selector with readable real labels", () => {
    const onSelect = vi.fn();
    render(<CircularSelector items={departments} activeId="education" onSelect={onSelect} />);

    expect(screen.getByLabelText("گردونه انتخاب حوزه")).toBeInTheDocument();
    expect(screen.getByText("مجموعه بعثت")).toBeInTheDocument();

    for (const department of departments) {
      expect(screen.getByRole("button", { name: department.title })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: departments[1].title }));
    expect(onSelect).toHaveBeenCalledWith("research");
  });

  it("keeps the wheel available at mobile sizes and suppresses a click after a drag", () => {
    const onSelect = vi.fn();
    render(<CircularSelector items={departments} activeId="education" onSelect={onSelect} />);
    const wheel = screen.getByLabelText("گردونه انتخاب حوزه");
    expect(wheel).toHaveClass("aspect-square");
    fireEvent.pointerDown(wheel, { pointerId: 1, pointerType: "touch", clientX: 160, clientY: 80 });
    fireEvent.pointerMove(wheel, { pointerId: 1, pointerType: "touch", clientX: 210, clientY: 100 });
    fireEvent.pointerUp(wheel, { pointerId: 1, pointerType: "touch", clientX: 210, clientY: 100 });
    fireEvent.click(screen.getByRole("button", { name: departments[1].title }));
    expect(onSelect).not.toHaveBeenCalledWith("research");
  });

  it("supports keyboard movement through the real department set", () => {
    const onSelect = vi.fn();
    render(<CircularSelector items={departments} activeId="education" onSelect={onSelect} />);

    fireEvent.keyDown(screen.getByLabelText("گردونه انتخاب حوزه"), { key: "ArrowLeft" });
    expect(onSelect).toHaveBeenCalledWith("research");

    fireEvent.keyDown(screen.getByLabelText("گردونه انتخاب حوزه"), { key: "ArrowRight" });
    expect(onSelect).toHaveBeenLastCalledWith("management");
  });
});
