"use client";

import { useCallback, useEffect, useState } from "react";
import { getData, postData, deleteData } from "@/lib/fetch-util";
import { Trash2 } from "lucide-react";
// Reusable style constants (scoped to this file)
const PANEL =
  "rounded-xl border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50 flex flex-col";
const PANEL_HEADER =
  "px-8 py-6 border-b border-border flex flex-col gap-4 bg-surface-dark";
const TITLE = "text-xl font-display font-semibold text-white tracking-wide";
const GRID = "grid grid-cols-1 sm:grid-cols-12 gap-3 w-full";
const INPUT_BASE =
  "w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2";
const ADD_BTN =
  "w-full bg-primary hover:bg-primary-hover text-black font-semibold px-2 py-1.5 rounded text-sm shadow-md transition-colors uppercase tracking-wider text-xs h-9 flex items-center justify-center";
const LIST_SCROLL = "flex-1 overflow-y-auto custom-scrollbar p-3";
const LIST = "space-y-2";
const LIST_ITEM =
  "group flex items-center justify-between p-3 rounded-md bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/10 transition-all duration-200";
const LIST_BTN =
  "text-primary/60 hover:text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-md p-1.5 transition-all";
const ICON = "material-icons text-lg block";
const TEXT_MUTED = "font-medium text-gray-200";
const DEL_BTN =
  "text-red-400 hover:text-red-300 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 rounded-md px-3 py-1.5 transition-all text-[10px] font-bold tracking-widest uppercase";

export default function AdminMetadataPage() {
  type Item = { _id: string; name: string; description?: string };
  // Lists
  const [contentTypes, setContentTypes] = useState<Item[]>([]);
  const [genres, setGenres] = useState<Item[]>([]);
  const [languages, setLanguages] = useState<Item[]>([]);
  const [countries, setCountries] = useState<Item[]>([]);
  const [awardCategories, setAwardCategories] = useState<Item[]>([]);

  const loadContentTypes = useCallback(async () => {
    const res = await getData<{ success: boolean; data: Item[] }>(
      "/content-types"
    );
    if (res?.success) setContentTypes(res.data || []);
  }, []);
  const loadGenres = useCallback(async () => {
    const res = await getData<{ success: boolean; data: Item[] }>("/genres");
    if (res?.success) setGenres(res.data || []);
  }, []);
  const loadLanguages = useCallback(async () => {
    const res = await getData<{ success: boolean; data: Item[] }>("/languages");
    if (res?.success) setLanguages(res.data || []);
  }, []);
  const loadCountries = useCallback(async () => {
    const res = await getData<{ success: boolean; data: Item[] }>("/countries");
    if (res?.success) setCountries(res.data || []);
  }, []);
  const loadAwardCategories = useCallback(async () => {
    const res = await getData<{ success: boolean; data: Item[] }>(
      "/award-categories"
    );
    if (res?.success) setAwardCategories(res.data || []);
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([
        loadContentTypes(),
        loadGenres(),
        loadLanguages(),
        loadCountries(),
        loadAwardCategories(),
      ]);
    })();
  }, [
    loadContentTypes,
    loadGenres,
    loadLanguages,
    loadCountries,
    loadAwardCategories,
  ]);

  // Content Types
  const [ctName, setCtName] = useState("");
  const [ctDesc, setCtDesc] = useState("");
  const [ctBusy, setCtBusy] = useState(false);
  const handleAddContentType = useCallback(async () => {
    if (!ctName.trim()) return;
    setCtBusy(true);
    try {
      await postData("/content-types", {
        name: ctName.trim(),
        description: ctDesc.trim(),
      });
      setCtName("");
      setCtDesc("");
      await loadContentTypes();
    } finally {
      setCtBusy(false);
    }
  }, [ctName, ctDesc, loadContentTypes]);
  const handleDeleteContentType = useCallback(
    async (id: string) => {
      await deleteData(`/content-types/${id}`);
      await loadContentTypes();
    },
    [loadContentTypes]
  );

  // Genres
  const [gName, setGName] = useState("");
  const [gDesc, setGDesc] = useState("");
  const [gBusy, setGBusy] = useState(false);
  const handleAddGenre = useCallback(async () => {
    if (!gName.trim()) return;
    setGBusy(true);
    try {
      await postData("/genres", {
        name: gName.trim(),
        description: gDesc.trim(),
      });
      setGName("");
      setGDesc("");
      await loadGenres();
    } finally {
      setGBusy(false);
    }
  }, [gName, gDesc, loadGenres]);
  const handleDeleteGenre = useCallback(
    async (id: string) => {
      await deleteData(`/genres/${id}`);
      await loadGenres();
    },
    [loadGenres]
  );

  // Languages
  const [lName, setLName] = useState("");
  const [lDesc, setLDesc] = useState("");
  const [lBusy, setLBusy] = useState(false);
  const handleAddLanguage = useCallback(async () => {
    if (!lName.trim()) return;
    setLBusy(true);
    try {
      await postData("/languages", {
        name: lName.trim(),
        description: lDesc.trim(),
      });
      setLName("");
      setLDesc("");
      await loadLanguages();
    } finally {
      setLBusy(false);
    }
  }, [lName, lDesc, loadLanguages]);
  const handleDeleteLanguage = useCallback(
    async (id: string) => {
      await deleteData(`/languages/${id}`);
      await loadLanguages();
    },
    [loadLanguages]
  );

  // Countries
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const handleAddCountry = useCallback(async () => {
    if (!cName.trim()) return;
    setCBusy(true);
    try {
      await postData("/countries", {
        name: cName.trim(),
        description: cDesc.trim(),
      });
      setCName("");
      setCDesc("");
      await loadCountries();
    } finally {
      setCBusy(false);
    }
  }, [cName, cDesc, loadCountries]);
  const handleDeleteCountry = useCallback(
    async (id: string) => {
      await deleteData(`/countries/${id}`);
      await loadCountries();
    },
    [loadCountries]
  );

  // Award Categories
  const [aName, setAName] = useState("");
  const [aDesc, setADesc] = useState("");
  const [aBusy, setABusy] = useState(false);
  const handleAddAwardCategory = useCallback(async () => {
    if (!aName.trim()) return;
    setABusy(true);
    try {
      await postData("/award-categories", {
        name: aName.trim(),
        description: aDesc.trim(),
      });
      setAName("");
      setADesc("");
      await loadAwardCategories();
    } finally {
      setABusy(false);
    }
  }, [aName, aDesc, loadAwardCategories]);
  const handleDeleteAwardCategory = useCallback(
    async (id: string) => {
      await deleteData(`/award-categories/${id}`);
      await loadAwardCategories();
    },
    [loadAwardCategories]
  );
  return (
    <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        {/* Header */}
        <div className="flex-1">
          <h2 className="text-white text-3xl lg:text-4xl font-serif font-bold leading-tight tracking-wide mb-4">
            Metadata Management
          </h2>
          <p className="text-[#bab29c] text-lg font-light max-w-2xl mb-4">
            Configure reference data for content and submissions.
          </p>
        </div>
      </div>

      {/* Grid of metadata cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <div className={`${PANEL} h-[450px]`}>
          <div className={PANEL_HEADER}>
            <h2 className={TITLE}>Content Types</h2>
            <div className={GRID}>
              <input
                className={`sm:col-span-4 ${INPUT_BASE}`}
                placeholder="Name"
                type="text"
                value={ctName}
                onChange={(e) => setCtName(e.target.value)}
              />
              <input
                className={`sm:col-span-6 ${INPUT_BASE}`}
                placeholder="Description"
                type="text"
                value={ctDesc}
                onChange={(e) => setCtDesc(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddContentType}
                disabled={ctBusy}
                className={`sm:col-span-2 ${ADD_BTN}`}
              >
                Add
              </button>
            </div>
          </div>
          <div className={LIST_SCROLL}>
            <ul className={LIST}>
              {contentTypes.map((item) => (
                <li className={LIST_ITEM} key={item._id}>
                  <span className={TEXT_MUTED}>{item.name}</span>
                  <button
                    className={DEL_BTN}
                    onClick={() => handleDeleteContentType(item._id)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className={`${PANEL} h-[450px]`}>
          <div className={PANEL_HEADER}>
            <h2 className={TITLE}>Genres</h2>
            <div className={GRID}>
              <input
                className={`sm:col-span-4 ${INPUT_BASE}`}
                placeholder="Name"
                type="text"
                value={gName}
                onChange={(e) => setGName(e.target.value)}
              />
              <input
                className={`sm:col-span-6 ${INPUT_BASE}`}
                placeholder="Description"
                type="text"
                value={gDesc}
                onChange={(e) => setGDesc(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddGenre}
                disabled={gBusy}
                className={`sm:col-span-2 ${ADD_BTN}`}
              >
                Add
              </button>
            </div>
          </div>
          <div className={LIST_SCROLL}>
            <ul className={LIST}>
              {genres.map((item) => (
                <li className={LIST_ITEM} key={item._id}>
                  <span className={TEXT_MUTED}>{item.name}</span>
                  <button
                    className={DEL_BTN}
                    onClick={() => handleDeleteGenre(item._id)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className={`${PANEL} h-[450px]`}>
          <div className={PANEL_HEADER}>
            <h2 className={TITLE}>Languages</h2>
            <div className={GRID}>
              <input
                className={`sm:col-span-4 ${INPUT_BASE}`}
                placeholder="Name"
                type="text"
                value={lName}
                onChange={(e) => setLName(e.target.value)}
              />
              <input
                className={`sm:col-span-6 ${INPUT_BASE}`}
                placeholder="Description"
                type="text"
                value={lDesc}
                onChange={(e) => setLDesc(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddLanguage}
                disabled={lBusy}
                className={`sm:col-span-2 ${ADD_BTN}`}
              >
                Add
              </button>
            </div>
          </div>
          <div className={LIST_SCROLL}>
            <ul className={LIST}>
              {languages.map((item) => (
                <li className={LIST_ITEM} key={item._id}>
                  <span className={TEXT_MUTED}>{item.name}</span>
                  <button
                    className={DEL_BTN}
                    onClick={() => handleDeleteLanguage(item._id)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className={`${PANEL} h-[450px]`}>
          <div className={PANEL_HEADER}>
            <h2 className={TITLE}>Countries</h2>
            <div className={GRID}>
              <input
                className={`sm:col-span-4 ${INPUT_BASE}`}
                placeholder="Name"
                type="text"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
              />
              <input
                className={`sm:col-span-6 ${INPUT_BASE}`}
                placeholder="Description"
                type="text"
                value={cDesc}
                onChange={(e) => setCDesc(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddCountry}
                disabled={cBusy}
                className={`sm:col-span-2 ${ADD_BTN}`}
              >
                Add
              </button>
            </div>
          </div>
          <div className={LIST_SCROLL}>
            <ul className={LIST}>
              {countries.map((item) => (
                <li className={LIST_ITEM} key={item._id}>
                  <span className={TEXT_MUTED}>{item.name}</span>
                    <button
                    className={DEL_BTN}
                    onClick={() => handleDeleteCountry(item._id)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className={`${PANEL} h-[450px] mb-12`}>
        <div className={PANEL_HEADER}>
          <h2 className={TITLE}>Award Categories</h2>
          <div className={GRID}>
            <input
              className={`sm:col-span-4 ${INPUT_BASE}`}
              placeholder="Name"
              type="text"
              value={aName}
              onChange={(e) => setAName(e.target.value)}
            />
            <input
              className={`sm:col-span-6 ${INPUT_BASE}`}
              placeholder="Description"
              type="text"
              value={aDesc}
              onChange={(e) => setADesc(e.target.value)}
            />
            <button
              type="button"
              onClick={handleAddAwardCategory}
              disabled={aBusy}
              className={`sm:col-span-2 ${ADD_BTN}`}
            >
              Add
            </button>
          </div>
        </div>
        <div className={LIST_SCROLL}>
          <ul className={LIST}>
            {awardCategories.map((item) => (
              <li className={LIST_ITEM} key={item._id}>
                <span className={TEXT_MUTED}>{item.name}</span>
                <button
                  className={DEL_BTN}
                  onClick={() => handleDeleteAwardCategory(item._id)}
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
