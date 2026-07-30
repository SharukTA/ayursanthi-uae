"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Search,
  Printer,
  Link2,
  CheckCircle2,
  FileText,
  ShieldCheck,
  BookOpen,
  HelpCircle,
  ChevronRight,
  ArrowUpRight,
  Share2,
  Info,
  Scale,
  ChevronDown,
  ListOrdered,
  X,
  Menu,
} from "lucide-react";
import { parseTermsSections } from "@/lib/terms-parser";
import { RichText } from "@/components/RichText";

export function AmazonTermsView({ page }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);

  // Parse structured sections from page body
  const sections = useMemo(() => {
    return parseTermsSections(page.body);
  }, [page.body]);

  // Handle active scroll-spy section detection
  useEffect(() => {
    if (typeof window === "undefined" || sections.length === 0) return;

    const handleScroll = () => {
      const scrollPos = window.scrollY + 180; // Offset for header + search toolbar
      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i];
        const el = document.getElementById(sec.id);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSectionId(sec.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase().trim();
    return sections.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.body.toLowerCase().includes(q)
    );
  }, [sections, searchQuery]);

  const totalMatches = filteredSections.length;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCopyLink = (secId, e) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}${window.location.pathname}#${secId}`;
      navigator.clipboard.writeText(url);
      setCopiedId(secId);
      toast.success("Clause anchor link copied to clipboard");
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  return (
    <div className="w-full">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          header,
          footer,
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-full {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-section {
            break-inside: avoid;
            page-break-inside: avoid;
            border-bottom: 1px solid #ddd !important;
            padding-bottom: 1rem !important;
            margin-bottom: 1rem !important;
          }
        }
      `}</style>

      {/* Top Banner Navigation / Policy Hub */}
      <div className="no-print bg-slate-900 border-b border-slate-800 py-3 text-xs text-slate-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
              <ShieldCheck className="size-4" />
              Ayursanthi Legal & Policy Hub
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Customer Conditions of Use</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Link
              href="/terms"
              className="rounded-md bg-emerald-600/20 px-3 py-1 font-semibold text-emerald-400 border border-emerald-500/30"
            >
              Terms &amp; Conditions
            </Link>
            <Link
              href="/faq"
              className="rounded-md px-3 py-1 font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              FAQ &amp; Support
            </Link>
            <Link
              href="/about"
              className="rounded-md px-3 py-1 font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              About Us
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Header Section */}
      <div className="no-print bg-slate-950 text-white border-b border-slate-800 py-10 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400 mb-4">
              <Scale className="size-3.5" />
              Official Agreement
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-white">
              {page.title || "Terms & Conditions"}
            </h1>
            {page.subtitle && (
              <p className="mt-3 text-sm sm:text-base text-slate-400">
                {page.subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Controls Bar (Search + Print + Copy Link) */}
      <div className="no-print sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm py-3">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clauses (e.g. cancellation, billing, account)..."
              className="w-full rounded-md border border-slate-300 bg-slate-50 pl-9 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 text-xs">
            {searchQuery && (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                {totalMatches} match{totalMatches === 1 ? "" : "es"}
              </span>
            )}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-xs"
            >
              <Printer className="size-3.5 text-slate-500" />
              Print Terms
            </button>
          </div>
        </div>
      </div>

      {/* Main Legal Content Container */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 print-full">
        {/* Amazon-Style Key Highlights Callout Box */}
        <div className="no-print mb-8 rounded-lg border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white shadow-xs">
              <Info className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Key Policy Summary &amp; Customer Commitments
              </h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Welcome to Ayursanthi. These Terms govern your purchase of authentic Ayurvedic products. Key parameters include:
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs font-medium text-slate-800">
                <div className="flex items-center gap-2 rounded bg-white p-2.5 border border-emerald-100 shadow-2xs">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span>100% Authentic Formulations</span>
                </div>
                <div className="flex items-center gap-2 rounded bg-white p-2.5 border border-emerald-100 shadow-2xs">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span>Cancel Before 24 Hours of Booking</span>
                </div>
                <div className="flex items-center gap-2 rounded bg-white p-2.5 border border-emerald-100 shadow-2xs">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span>Encrypted Payment Processing</span>
                </div>
                <div className="flex items-center gap-2 rounded bg-white p-2.5 border border-emerald-100 shadow-2xs">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span>Protected Intellectual Property</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Accordion Top Selector (Amazon Mobile Style) */}
        <div className="no-print lg:hidden mb-6">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <button
              onClick={() => setMobileDropdownOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-left text-xs font-bold text-slate-900"
            >
              <div className="flex items-center gap-2 truncate">
                <ListOrdered className="size-4 shrink-0 text-emerald-700" />
                <span className="text-slate-500 font-medium">Jump to Section:</span>
                <span className="truncate text-emerald-800 font-bold">
                  {sections.find((s) => s.id === activeSectionId)?.cleanTitle ||
                    sections.find((s) => s.id === activeSectionId)?.title ||
                    "Table of Contents"}
                </span>
              </div>
              <ChevronDown
                className={`size-4 text-slate-400 transition-transform ${
                  mobileDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {mobileDropdownOpen && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 max-h-64 overflow-y-auto">
                {sections.map((sec, idx) => {
                  const isActive = activeSectionId === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={(e) => scrollToSection(sec.id, e)}
                      className={`flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-xs transition ${
                        isActive
                          ? "bg-emerald-50 text-emerald-800 font-bold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                          isActive
                            ? "bg-emerald-700 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="truncate">{sec.cleanTitle || sec.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Sticky Table of Contents Sidebar (Desktop) */}
          <aside className="no-print hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="sticky top-20 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between pb-3 border-b border-slate-100">
                <span>Table of Contents</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-bold">
                  {sections.length} Sections
                </span>
              </h3>

              <nav className="mt-3 max-h-[calc(100vh-12rem)] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {sections.map((sec, idx) => {
                  const isActive = activeSectionId === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={(e) => scrollToSection(sec.id, e)}
                      className={`w-full text-left group flex items-start gap-2.5 rounded-md px-3 py-2 text-xs transition ${
                        isActive
                          ? "bg-emerald-50 text-emerald-800 font-bold border-l-2 border-emerald-600"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                          isActive
                            ? "bg-emerald-700 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="line-clamp-2 leading-5">
                        {sec.cleanTitle || sec.title}
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Have legal queries?</span>
                <Link
                  href="/faq"
                  className="font-semibold text-emerald-700 hover:underline flex items-center gap-0.5"
                >
                  Visit Support <ChevronRight className="size-3" />
                </Link>
              </div>
            </div>
          </aside>

          {/* Right Column: Detailed Terms Cards */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-6 print-full">
            {filteredSections.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
                <Search className="mx-auto size-8 text-slate-300 mb-2" />
                <h4 className="text-sm font-bold text-slate-800">
                  No matching clauses found
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  No section contained &ldquo;{searchQuery}&rdquo;. Try searching for broader terms like &ldquo;cancellation&rdquo; or &ldquo;pricing&rdquo;.
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 rounded bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              filteredSections.map((sec, idx) => {
                const isCopied = copiedId === sec.id;
                return (
                  <article
                    key={sec.id}
                    id={sec.id}
                    className="print-section scroll-mt-24 rounded-lg border border-slate-200 bg-white p-6 shadow-xs transition hover:border-slate-300"
                  >
                    {/* Section Header */}
                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white shadow-2xs">
                          {sec.number || idx + 1}
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                          {sec.title}
                        </h2>
                      </div>

                      <button
                        onClick={(e) => handleCopyLink(sec.id, e)}
                        title="Copy direct link to this section"
                        className="no-print shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-700 transition"
                      >
                        {isCopied ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : (
                          <Link2 className="size-4" />
                        )}
                      </button>
                    </div>

                    {/* Section Body */}
                    <div className="mt-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                      <RichText body={sec.body} className="prose-xs max-w-none text-slate-700 space-y-3" />
                    </div>
                  </article>
                );
              })
            )}

            {/* Bottom Document Footnote */}
            <div className="no-print rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">
              <p>
                These Terms &amp; Conditions are subject to change. Continued usage of the Ayursanthi platform signifies acceptance of updated parameters.
              </p>
            </div>
          </main>
        </div>
      </div>

      {/* Floating Action Button for Mobile TOC Drawer (Amazon Mobile Style) */}
      <div className="no-print fixed bottom-5 right-5 z-40 lg:hidden">
        <button
          onClick={() => setMobileTocOpen(true)}
          className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl hover:bg-slate-800 transition active:scale-95 border border-slate-700"
        >
          <ListOrdered className="size-4 text-emerald-400" />
          <span>TOC</span>
          <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-slate-950 font-extrabold">
            {sections.length}
          </span>
        </button>
      </div>

      {/* Mobile Bottom Sheet Drawer Modal */}
      {mobileTocOpen && (
        <div className="no-print fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs lg:hidden">
          <div
            className="fixed inset-0"
            onClick={() => setMobileTocOpen(false)}
          />

          <div className="relative z-10 max-h-[85vh] w-full rounded-t-2xl border-t border-slate-200 bg-white p-5 shadow-2xl overflow-hidden flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ListOrdered className="size-5 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Table of Contents ({sections.length} Sections)
                </h3>
              </div>
              <button
                onClick={() => setMobileTocOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Drawer Body - Scrollable Sections */}
            <nav className="mt-3 flex-1 overflow-y-auto space-y-1 pr-1">
              {sections.map((sec, idx) => {
                const isActive = activeSectionId === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={(e) => scrollToSection(sec.id, e)}
                    className={`w-full text-left flex items-start gap-3 rounded-lg px-3 py-2.5 text-xs transition ${
                      isActive
                        ? "bg-emerald-50 text-emerald-800 font-bold border-l-3 border-emerald-600"
                        : "text-slate-700 hover:bg-slate-50 font-medium"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                        isActive
                          ? "bg-emerald-700 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="line-clamp-2 leading-5">
                      {sec.cleanTitle || sec.title}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
