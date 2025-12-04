import User from "../models/user.model";
import jwt from "jsonwebtoken";

// const registerUser = async (req, res) => {
//     try {
//       const { username, email, password } = req.body;
//       console.log(email);
//       const decision = await aj.protect(req, { requested: 1, email }); // Pass user email for context

//       if (decision.isDenied()) {
//         if (decision.reason.isEmail()) {
//           res.writeHead(403, { "Content-Type": "application/json" });
//           res.end(JSON.stringify({ message: "Invalid Email Address" }));
//           console.log("hi");
//         }
//       } // Handle other denial reasons if needed

//       // Check if user already exists
//       const existingUser = await User.findOne({ email });
//       if (existingUser) {
//         return res.status(400).json({ message: "User already exists" });
//       }
//       // Create new user
//       const newUser = new User({ username, email, password });
//       await newUser.save();

//       // Generate JWT token for email verification
//       const verificationToken = jwt.sign(
//         { id: newUser._id, purpose: "email-verification" },
//         process.env.JWT_SECRET,
//         {
//           expiresIn: "3h",
//         }
//       );

//       const newVerification = new Verification({
//         userId: newUser._id,
//         token: verificationToken,
//         expiredAt: Date.now() + 3 * 60 * 60 * 1000, // 3 hours from now
//       });
//       await newVerification.save();
//       // Send verification email
//       const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
//       const emailBody = `<h1>Email Verification</h1>
//       <p>Please click the link below to verify your email address:</p>
//       <a href="${verificationUrl}">Verify Email</a>
//       <p>This link will expire in 3 hours.</p>
//       `;
//       const emailSubject = "Email Verification";
//       const isEmailSent = await sendEmail(email, emailSubject, emailBody);

//       if (!isEmailSent) {
//         return res
//           .status(500)
//           .json({ message: "Failed to send verification email" });
//       }
//       res.status(201).json({
//         message:
//           "Verification email sent to your emial. Please check and verify your account.",
//       });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ message: "Internal Server Error" });
//     }
//   };

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const newUser = new User({ name, email, password });
    await newUser.save();

    // Generate JWT token for email verification
    const verificationToken = jwt.sign(
      {
        id: newUser._id,
        // purpose: "email-verification"
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "3h",
      }
    );

    req.session.user = {
      id: newUser._id,
      email: newUser.email,
      name: newUser.fullName,
      role: newUser.role,
    };

    res.status(201).json({
      message: "User registered successfully",
      user: req.session.user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const signInUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    //TODO: CHECK IF THE EMAIL IS VERIFIED

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect)
      return res.status(401).json({ message: "Invalid credentials" });

    req.session.user = {
      id: user._id,
      email: user.email,
      name: user.fullName,
      role: user.role,
    };

    res.status(200).json({
      message: "User signed in successfully",
      user: req.session.user,
    });
  } catch (error) {}
};
