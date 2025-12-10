import mongoose, { Schema, Model } from "mongoose";
import * as bcrypt from "bcryptjs";

export interface UserDocument {
  email: string;
  password: string;
  role: "user" | "staff" | "admin";
  fullName?: string;
  profilePicture: string;
  bio?: string;
  phoneNumber?: string;
}

export interface UserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export type UserModel = Model<UserDocument, {}, UserMethods>;

const userSchema = new Schema<UserDocument, UserModel, UserMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      maxLength: 100,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minLength: 8,
      maxLength: 100,
      trim: true,
      select: false, // to not return the password in the response, + .select('+password') to include it
    },
    role: {
      type: String,
      enum: ["user", "staff", "admin"],
      default: "user",
    },
    fullName: {
      type: String,
      maxLength: 100,
      trim: true,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      maxLength: 200,
      trim: true,
    },
    phoneNumber: {
      type: String,
      maxLength: 15,
      trim: true,
    },
  },
  { timestamps: true }
);

const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(saltRounds);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
) {
  console.log("Comparing passwords:", candidatePassword, this.password);
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
