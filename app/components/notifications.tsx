import { useMatches } from "@remix-run/react";
import Badge from '@mui/material/Badge';
import NotificationsIcon from '@mui/icons-material/Notifications';
import IconButton from '@mui/material/IconButton';

interface RootLoaderData {
  user: {
    notificationsReceived?: { id: string }[];
  } | null;
}

export default function Notifications() {
  const matches = useMatches();
  const rootData = matches.find(m => m.id === "root")?.data as RootLoaderData | undefined;
  const notificationCount = rootData?.user?.notificationsReceived?.length ?? 0;

  return (
    <a href="/notifications">
      <IconButton
         id="button-notifications"
         style={{ width: "auto", height:"100%", margin:"0 1rem", color: 'black' }}>
        <Badge badgeContent={notificationCount} color="error">
          <NotificationsIcon style={{ fontSize: 30 }} />
        </Badge>
      </IconButton>
    </a>
  );
}