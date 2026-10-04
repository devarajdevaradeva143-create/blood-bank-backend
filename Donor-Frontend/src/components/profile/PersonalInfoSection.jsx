import { User } from "lucide-react";
import Input from "../ui/Input";
import Select from "../ui/Select";
import { BLOOD_GROUPS, GENDERS, TN_DISTRICTS } from "../../data/constants";

function toValue(v) {
  // Input/Select components value string-ah tharanga, native event illa.
  if (v && typeof v === "object" && "target" in v) return v.target.value;
  return v ?? "";
}

export default function PersonalInfoSection({
  donor,
  editing,
  onChange,
  errors,
  t,
}) {
  const handleChange = (field) => (v) => onChange(field, toValue(v));

  const safe = (v) => v ?? "";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-1 text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <User className="h-5 w-5 text-brand-600" />
        {t("profile.section.personalInfo")}
      </h3>
      <p className="mb-6 text-xs text-gray-500 dark:text-slate-400">
        {t("profile.section.personalDesc")}
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label={t("profile.field.fullName")}
          id="name"
          value={safe(donor.name)}
          onChange={handleChange("name")}
          error={errors.name}
          disabled
          required
          placeholder={t("profile.placeholder.name")}
        />
        <Select
          label={t("profile.field.bloodGroup")}
          id="bloodGroup"
          value={safe(donor.bloodGroup)}
          onChange={handleChange("bloodGroup")}
          options={BLOOD_GROUPS}
          error={errors.bloodGroup}
          disabled
          required
        />
        {/* Email — user edit pannalam */}
        <Input
          label={t("profile.field.email")}
          id="email"
          type="email"
          value={safe(donor.email)}
          onChange={handleChange("email")}
          error={errors.email}
          disabled={!editing}
          required
          placeholder={t("profile.placeholder.email")}
        />
        {/* Contact No — user edit pannalam */}
        <Input
          label={t("profile.field.mobile")}
          id="phone"
          type="tel"
          value={safe(donor.phone)}
          onChange={handleChange("phone")}
          error={errors.phone}
          disabled={!editing}
          required
          placeholder={t("profile.placeholder.phone")}
          maxLength={10}
        />
        <Input
          label={t("profile.field.dob")}
          id="dob"
          type="date"
          value={safe(donor.dob)}
          onChange={handleChange("dob")}
          error={errors.dob}
          disabled
          required
        />
        <Select
          label={t("profile.field.gender")}
          id="gender"
          value={safe(donor.gender)}
          onChange={handleChange("gender")}
          options={GENDERS}
          error={errors.gender}
          disabled
          required
        />
        <Input
          label={t("profile.field.address")}
          id="address"
          value={safe(donor.address)}
          onChange={handleChange("address")}
          error={errors.address}
          disabled={!editing}
          placeholder={t("profile.placeholder.address")}
        />
        {/* District — user edit pannalam */}
        <Select
          label={t("profile.field.district")}
          id="district"
          value={safe(donor.district)}
          onChange={handleChange("district")}
          options={TN_DISTRICTS}
          error={errors.district}
          disabled={!editing}
          required
        />
      </div>
    </div>
  );
}
