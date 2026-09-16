import { Schema, model } from "mongoose";

/**
 * The credited-role vocabulary offered in the CMS crew editor's "Other Crew"
 * group, managed by admins from the Metadata page.
 *
 * DELIBERATELY NOT `CrewRole`. That collection belongs to the legacy
 * CrewMember/CrewRole/CrewAssignment system covering 2022-2025 films, which
 * nothing in the current crew editor reads — a submission's crew is embedded
 * on the submission document and its `role` is plain text. Its 90 entries were
 * accumulated by a different workflow and show it: typos ("Cinematopgraher",
 * "Poducer"), the same role under four spellings (Cinematographer /
 * Cinematography / DOP / Director of Photography), and department names that
 * are not roles at all ("Art Department", "BTS").
 *
 * Reusing it would also mean the dropdown offering Director, Producer and
 * Actor, which is exactly what the fixed per-group option sets in the client's
 * lib/crew-roles.ts already cover. This list holds everything those three
 * groups do not.
 *
 * MONGOOSE TRAP (see AGENTS.md): a field declared only on the TypeScript
 * interface is silently dropped on save. Both fields below appear in the
 * interface AND the Schema object. When adding one, do the same and verify
 * with a real query.
 */
export interface ICreditRole {
  name: string;
  description?: string;
}

const creditRoleSchema = new Schema<ICreditRole>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxLength: 120,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxLength: 500,
    },
  },
  { timestamps: true },
);

const CreditRole = model("CreditRole", creditRoleSchema);
export default CreditRole;
