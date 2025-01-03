import { FC } from "react";
import { Route, Routes } from "react-router-dom";

// Local
import Follow from "../pages/Follow";
import Leaderboard from "../pages/Leaderboard";
import Profile from "../pages/Profile";
import Trade from "../pages/Trade";

const DashboardRoutes: FC = () => {
  return (
    <Routes>
      <Route path="profile/:user" element={<Profile />} />
      <Route path="follow" element={<Follow />} />
      <Route path="leaderboard" element={<Leaderboard />} />
      <Route path="trade" element={<Trade />} />
    </Routes>
  );
};

export default DashboardRoutes;
