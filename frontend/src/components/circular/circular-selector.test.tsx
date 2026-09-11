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
  it("restores the orbital desktop selector while keeping long Persian labels readable", () => {
    const onSelect = vi.fn();
    render(<CircularSelector items={departments} activeId="education" onSelect={onSelect} />);

    expect(screen.getByLabelText("گردونه انتخاب حوزه")).toBeInTheDocument();
    expect(screen.getByText("مجموعه بعثت")).toBeInTheDocument();

    for (const department of departments) {
      const buttons = screen.getAllByRole("button", { name: department.title });
      expect(buttons).toHaveLength(2);
      expect(buttons.every((button) => button.outerHTML.includes("text-wrap:balance"))).toBe(true);
    }

    fireEvent.click(screen.getAllByRole("button", { name: departments[1].title })[0]);
    expect(onSelect).toHaveBeenCalledWith("research");
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
