"use client";

import { type FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api/client";

type ContactFormState = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [state, setState] = useState<ContactFormState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    const formData = new FormData(event.currentTarget);

    try {
      await apiRequest("contact/", {
        method: "POST",
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          email: String(formData.get("email") ?? ""),
          subject: String(formData.get("subject") ?? ""),
          message: String(formData.get("message") ?? ""),
        }),
      });
      setState("success");
      setMessage("پیام شما با موفقیت ارسال شد. به زودی با شما تماس می‌گیریم.");
      (event.target as HTMLFormElement).reset();
    } catch {
      setState("error");
      setMessage("خطا در ارسال پیام. لطفاً دوباره تلاش کنید یا با شماره تماس مدرسه تماس بگیرید.");
    }
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="border-b border-slate-100 p-6 sm:p-8">
        <h2 className="text-xl font-black text-[#062452]">ارسال پیام</h2>
        <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
          پیام خود را از طریق فرم زیر برای ما ارسال کنید.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 p-6 sm:p-8 md:grid-cols-2">
        <label className="block text-right">
          <span className="mb-2 block text-sm font-black text-[#062452]">
            نام و نام خانوادگی <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            name="name"
            required
            placeholder="نام شما"
            className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white"
          />
        </label>

        <label className="block text-right">
          <span className="mb-2 block text-sm font-black text-[#062452]">
            شماره تماس <span className="text-rose-500">*</span>
          </span>
          <input
            type="tel"
            name="phone"
            required
            placeholder="شماره تلفن"
            className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white"
          />
        </label>

        <label className="block text-right">
          <span className="mb-2 block text-sm font-black text-[#062452]">نشانی ایمیل</span>
          <input
            type="email"
            name="email"
            placeholder="example@email.com"
            className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white"
          />
        </label>

        <label className="block text-right">
          <span className="mb-2 block text-sm font-black text-[#062452]">
            موضوع <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            name="subject"
            required
            placeholder="موضوع پیام"
            className="h-[3.25rem] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right text-sm font-bold text-[#062452] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white"
          />
        </label>

        <label className="block text-right md:col-span-2">
          <span className="mb-2 block text-sm font-black text-[#062452]">
            متن پیام <span className="text-rose-500">*</span>
          </span>
          <textarea
            name="message"
            required
            rows={5}
            placeholder="پیام خود را بنویسید..."
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm font-bold text-[#062452] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white"
          />
        </label>

        {message ? (
          <div
            className={`rounded-2xl px-4 py-4 text-right text-sm font-black md:col-span-2 ${
              state === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {message}
          </div>
        ) : null}

        <div className="flex justify-end md:col-span-2">
          <button
            type="submit"
            disabled={state === "submitting"}
            className="besat-navy-button inline-flex h-[3.25rem] items-center justify-center rounded-2xl bg-[#12395b] px-8 text-sm font-black transition hover:bg-[#0d2f4d] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {state === "submitting" ? "در حال ارسال..." : "ارسال پیام"}
          </button>
        </div>
      </form>
    </div>
  );
}
