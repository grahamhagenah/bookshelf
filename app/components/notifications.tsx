import { useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs  } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import * as React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { getUserById } from "~/models/user.server";
import Badge from '@mui/material/Badge';
import NotificationsIcon from '@mui/icons-material/Notifications';
import IconButton from '@mui/material/IconButton';


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return user;
}

export default function Notifications() {

  const data = useLoaderData<typeof loader>();

  const handleClose = () => {
    setAnchor(null);
  };

  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchor);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget);
  };

  return (
    <a href="/notifications">
      <IconButton 
         id="button-notifications"
        //  aria-controls={open ? 'button-notifications' : undefined}
        //  aria-haspopup="true"
        //  aria-expanded={open ? 'true' : undefined}
        //  onClick={handleClick}
         style={{ width: "auto", height:"100%", margin:"0 1rem", color: 'black' }}>
        <Badge badgeContent={data.user?.notificationsReceived.length} color="error">
          <NotificationsIcon style={{ fontSize: 30 }} />
        </Badge>
      </IconButton>
      {/* <Menu
        id="menu-notifications"
        aria-labelledby="menu-notifications"
        anchorEl={anchor}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
      {data.user?.notificationsReceived.map((notification) => (
        <MenuItem key={notification.id}>
          <a href="/notifications">
            <p><strong>{notification.senderName + " "}</strong> sent a friend request</p>
          </a>
        </MenuItem>
      ))}
      </Menu> */}
    </a>
  );
}