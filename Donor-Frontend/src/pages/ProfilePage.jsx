import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, Download } from "lucide-react";
import { useDonorAuth } from "../context/DonorAuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import ProfileSummaryCard from "../components/profile/ProfileSummaryCard";
import PersonalInfoSection from "../components/profile/PersonalInfoSection";
import DonationInfoSection from "../components/profile/DonationInfoSection";
import Certificate from "../components/donate/Certificate";
import Button from "../components/ui/Button";
import { fetchDonorProfile } from "../lib/api";
import { saveLocalDonor } from "../services/authApi";

function loadDonationHistory() {
  try {
    const hRaw = localStorage.getItem("donorDonations");
    const hist = hRaw ? JSON.parse(hRaw) : [];
    if (!Array.isArray(hist)) return [];
    // Pending-ah approved-a maatha vendaam — real status-ve vei.
    return hist;
  } catch {
    return [];
  }
}

function computeHistoryStats(hist) {
  try {
    const list = Array.isArray(hist) ? hist : [];
    const approved = list.filter((h) => (h?.status || "approved") === "approved");
    const dates = approved
      .map((h) => String(h?.date || "").slice(0, 10))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    const last = dates.length > 0 ? dates[dates.length - 1] : "";
    let next = "";
    // Donate pannalana (history empty) Eligible dhaan — pudhu donor ready.
    let eligible = "Eligible";
    if (last) {
      const d = new Date(`${last}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        d.setDate(d.getDate() + 90);
        next = d.toISOString().slice(0, 10);
        eligible = new Date().toISOString().slice(0, 10) >= next ? "Eligible" : "Not Eligible";
      }
    }
    return { total: approved.length, last, next, eligible };
  } catch {
    return { total: 0, last: "", next: "", eligible: "Eligible" };
  }
}

const EMPTY_DONOR = {
  name: "",
  email: "",
  phone: "",
  password: "",
  dob: "",
  gender: "",
  bloodGroup: "",
  address: "",
  district: "",
  donorId: "",
  photo: "",
  registrationDate: "",
  lastDonationDate: "",
  totalDonations: 0,
  eligibilityStatus: "",
  nextEligibleDate: "",
  isActive: true,
};

function loadRealDonor(fallbackEmail = "") {
  // Real source: registeredDonor identity + approved history stats.
  // Totals/dates-ah history-la irundhu recalculate pannu — stale mock value trust panna vendaam.
  try {
    const raw = localStorage.getItem("registeredDonor");
    const reg =
      raw && JSON.parse(raw) && typeof JSON.parse(raw) === "object"
        ? JSON.parse(raw)
        : null;
    const stats = computeHistoryStats(loadDonationHistory());
    if (!reg) {
      return {
        ...EMPTY_DONOR,
        email: fallbackEmail || "",
        totalDonations: stats.total,
        lastDonationDate: stats.last,
        nextEligibleDate: stats.next,
        eligibilityStatus: stats.eligible,
      };
    }
    return {
      ...EMPTY_DONOR,
      ...reg,
      name: reg.name || reg.fullName || "",
      email: reg.email || fallbackEmail || "",
      phone: reg.phone || reg.mobile || "",
      password: reg.password || "",
      dob: reg.dob || "",
      gender: reg.gender || "",
      bloodGroup: reg.bloodGroup || "",
      address: reg.address || "",
      district: reg.district || "",
      donorId: reg.donorId || "",
      photo: reg.photo || reg.photoUrl || reg.avatar || "",
      registrationDate: reg.registrationDate || reg.createdAt?.slice?.(0, 10) || "",
      lastDonationDate: stats.last,
      totalDonations: stats.total,
      eligibilityStatus: stats.eligible,
      nextEligibleDate: stats.next,
      isActive: reg.isActive ?? true,
    };
  } catch {
    return { ...EMPTY_DONOR, email: fallbackEmail || "" };
  }
}

function isProfileIncomplete(donor) {
  // Address register-la collect pannala, so required illa — false incomplete loop varum.
  return (
    !String(donor.name || "").trim() ||
    !String(donor.email || "").trim() ||
    !String(donor.phone || "").trim() ||
    !donor.gender ||
    !donor.bloodGroup ||
    !donor.district
  );
}

export default function ProfilePage() {
  const { logout, donorEmail, login } = useDonorAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [donor, setDonor] = useState(() => loadRealDonor(donorEmail));
  const [snapshot, setSnapshot] = useState(() => loadRealDonor(donorEmail));
  // Profile incomplete-ah irundha direct-ah edit mode-la open pannu.
  const [editing, setEditing] = useState(() =>
    isProfileIncomplete(loadRealDonor(donorEmail))
  );
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const showEmptyHint = !String(donor.name || "").trim() && !editing;

  const handleChange = (field, value) => {
    setDonor((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSaved(false);
  };

  // Profile photo set panna udane state + localStorage-la save aagum.
  const handlePhotoChange = (dataUrl) => {
    setDonor((prev) => ({ ...prev, photo: dataUrl }));
    setSaved(false);
    try {
      const raw = localStorage.getItem("registeredDonor");
      const reg = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        "registeredDonor",
        JSON.stringify({ ...reg, photo: dataUrl })
      );
    } catch {
      // ignore storage errors
    }
  };

  const validate = () => {
    // Editable 3 fields mattum validate pannu — address optional
    // (register-la collect pannala; demo/test address-a delete panna empty allow).
    // Read-only fields block panna koodadhu.
    const newErrors = {};
    if (
      !String(donor.email || "").trim() ||
      !/\S+@\S+\.\S+/.test(String(donor.email || ""))
    )
      newErrors.email = t("profile.validation.email");
    if (
      !String(donor.phone || "").trim() ||
      !/^[0-9]{10}$/.test(String(donor.phone || ""))
    )
      newErrors.phone = t("profile.validation.phone");
    if (!donor.district) newErrors.district = t("profile.validation.district");
    return newErrors;
  };

  const handleSave = () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    // Fake donorId generate panna vendaam — backend id-ve source.
    // Totals/dates-ah history-la irundhu recalculate pannu.
    const stats = computeHistoryStats(loadDonationHistory());
    const toSave = {
      ...donor,
      donorId: donor.donorId || "",
      registrationDate:
        donor.registrationDate || new Date().toISOString().slice(0, 10),
      totalDonations: stats.total,
      lastDonationDate: stats.last,
      nextEligibleDate: stats.next,
      eligibilityStatus: stats.eligible,
    };
    try {
      localStorage.setItem("registeredDonor", JSON.stringify(toSave));
    } catch {
      // ignore
    }
    // Email maathuna auth context-um sync pannu.
    try {
      if (
        String(toSave.email || "").trim().toLowerCase() !==
        String(donorEmail || "").trim().toLowerCase()
      ) {
        login(String(toSave.email || "").trim().toLowerCase());
      }
    } catch {
      // ignore
    }
    setDonor(toSave);
    setSnapshot(toSave);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCancel = () => {
    // Edit cancel panna last saved data-ku revert aagum.
    setDonor(snapshot);
    setEditing(false);
    setErrors({});
    setSaved(false);
  };

  const [history, setHistory] = useState(loadDonationHistory);
  const [certData, setCertData] = useState(null);

  // Mount-aagumbodhu backend-irundhu fresh profile edu — stale mock data overwrite aagum.
  useEffect(() => {
    let cancelled = false;
    fetchDonorProfile()
      .then((data) => {
        if (cancelled || !data?.user) return;
        try {
          saveLocalDonor(data.user);
        } catch {
          // ignore
        }
        if (cancelled) return;
        const freshHist = loadDonationHistory();
        setHistory(freshHist);
        const fresh = loadRealDonor(data.user.email || donorEmail);
        setDonor(fresh);
        setSnapshot(fresh);
        setEditing((prev) => (prev ? isProfileIncomplete(fresh) : prev));
      })
      .catch(() => {
        // offline-na local data-ve kaatu
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const refresh = () => {
      const freshHist = loadDonationHistory();
      setHistory(freshHist);
      const fresh = loadRealDonor(donorEmail);
      setDonor(fresh);
      setSnapshot(fresh);
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [donorEmail]);

  const openCertificate = (h) => {
    // Certificate open panna munnadi fresh history-ah re-read pannu.
    let fresh = h;
    try {
      const hRaw = localStorage.getItem("donorDonations");
      const hist = hRaw ? JSON.parse(hRaw) : [];
      if (Array.isArray(hist) && h && h.requestId) {
        const found = hist.find((x) => x && x.requestId === h.requestId);
        if (found) fresh = found;
      }
    } catch {
      // ignore, fallback to passed entry
    }
    // History-la missing fields-irundha profile data-va merge pannu.
    setCertData({
      requestId: fresh.requestId || `CERT-${Date.now()}`,
      donorName: fresh.donorName || donor.name || "Donor",
      bloodGroup: fresh.bloodGroup || donor.bloodGroup || "—",
      mobile: fresh.mobile || donor.phone || "",
      center: fresh.center || "Life Saver Blood Bank",
      date: fresh.date || new Date().toISOString().slice(0, 10),
      time: fresh.time || "",
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          {t("profile.page.title")}
        </h1>
        <p className="mt-2 text-base text-gray-600 dark:text-slate-400">
          {t("profile.page.subtitle")}
        </p>
      </div>

      {saved && (
        <div className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" role="status">
          {t("profile.success")}
        </div>
      )}

      {showEmptyHint && (
        <div className="mb-4 rounded-lg bg-amber-50 p-4 text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" role="status">
          {t("profile.cert.incomplete")}
        </div>
      )}

      <div className="mb-8">
        <ProfileSummaryCard
          donor={donor}
          t={t}
          editablePhoto
          onPhotoChange={handlePhotoChange}
        />
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        {!editing ? (
          <Button
            onClick={() => {
              setSnapshot(donor);
              setEditing(true);
            }}
            variant="outline"
          >
            {t("profile.edit")}
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button onClick={handleSave} variant="primary">
              {t("profile.save")}
            </Button>
            <Button onClick={handleCancel} variant="outline">
              {t("profile.cancel")}
            </Button>
          </div>
        )}
        <Button onClick={handleLogout} variant="light">
          {t("profile.logout")}
        </Button>
      </div>

      <div className="mb-8">
        <PersonalInfoSection
          donor={donor}
          editing={editing}
          onChange={handleChange}
          errors={errors}
          t={t}
        />
      </div>

      <div className="mb-8">
        <DonationInfoSection donor={donor} t={t} />
      </div>

      {/* Donation history + certificate download */}
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
          <Award className="h-5 w-5 text-brand-600" />
          {t("profile.cert.title")}
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("profile.cert.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {history
              .slice()
              .reverse()
              .map((h, i) => {
                const district = h.district || "—";
                return (
                  <div
                    key={h.requestId || i}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {h.date || "—"} {h.time ? `· ${h.time}` : ""} —{" "}
                        {h.bloodGroup || donor.bloodGroup || ""}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {h.requestId || ""} · {h.center || ""}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {t("profile.cert.district")}: {district}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCertificate(h)}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      <Download className="h-4 w-4" />
                      {t("profile.cert.button")}
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {certData && (
        <Certificate data={certData} onClose={() => setCertData(null)} />
      )}
    </div>
  );
}
