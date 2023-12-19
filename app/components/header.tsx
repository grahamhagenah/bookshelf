
import { Form, Link } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import logo from "~/images/logo.svg";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import * as React from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { getUserById } from "~/models/user.server";
import { getNotifications, createFriendship } from "~/models/user.server"; 
import Badge from '@mui/material/Badge';
import Search from "./search"
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useNavigate } from "@remix-run/react";
import NotificationsIcon from '@mui/icons-material/Notifications';
import IconButton from '@mui/material/IconButton';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById({ userId });

  return {user};
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const friendId = formData.get("friendId");
  const friend = await getUserById({ friendId });

  await createFriendship(userId, friendId)
}

export default function Header() {

  const data = useLoaderData<typeof loader>();

  return (
    <header className="w-full flex items-center justify-between">
      <Link id="logo" to="/books">
        <img src={logo} className="rounded-lg" alt="Lend"/>
        <h1 className="text-4xl font-semibold">Lend</h1>
      </Link>
      <div className="flex">
        {data.user && <Search />}
        <PositionedMenu/>
      </div>
    </header>
)}

const theme = createTheme({
  palette: {
    blue: {
      main: '#000000',
      light: '#E9DB5D',
      dark: '#A29415',
      contrastText: '#242105',
    },
  },
});

function PositionedMenu() {

  const data = useLoaderData<typeof loader>();

    // console.log(data.notifications)
    console.log(data.user?.notificationsReceived)

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setAnchorNotification(null);
  };

  const [anchorNotification, setAnchorNotification] = React.useState<null | HTMLElement>(null);
  const openNotifications = Boolean(anchorNotification);

  const handleClickNotification = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorNotification(event.currentTarget);
  };

  

  return (
    <ThemeProvider theme={theme}>
      <h2>{data.user?.email}</h2>
      <IconButton 
         id="demo-positioned-button-notifications"
         color="blue"
         margin="1rem"
         aria-controls={openNotifications ? 'demo-positioned-menu-notifications' : undefined}
         aria-haspopup="true"
         aria-expanded={openNotifications ? 'true' : undefined}
         onClick={handleClickNotification}
         style={{ width: "auto", height:"100%", margin:"0 1rem" }}>
        <Badge badgeContent={data.user?.notificationsReceived.length} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu
        id="demo-positioned-menu-notifications"
        aria-labelledby="demo-positioned-button-notifications"
        anchorEl={anchorNotification}
        open={openNotifications}
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
        <MenuItem key={notification.id} className="notifications">
            Friend request from {notification.friendId}
            <form>
              <input type="hidden" name="friendId" value={notification.friendId} />
              <button type="submit">
                Accept
              </button>
            </form>
        </MenuItem>
      ))}
      </Menu>

      <Button
        id="demo-positioned-button"
        color="blue"
        aria-controls={open ? 'demo-positioned-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
      >
        <AccountCircleIcon className="mr-2" />
        {data.user ? data.user.firstname: "Log In"}
      </Button>
      <Menu
        id="demo-positioned-menu"
        aria-labelledby="demo-positioned-button"
        anchorEl={anchorEl}
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
        <MenuItem onClick={handleClose}>
          <a href="/books">
            <button className="stretched-link">
              My Library
            </button>
          </a>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <Form action="/books" method="post">
            <button className="stretched-link" type="submit">
              Account Settings
            </button>
          </Form>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <a href="/friends">
            <button className="stretched-link">
              Friends
            </button>
          </a>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <Form action="/logout" method="post">
            <button className="stretched-link" type="submit">
              Logout
            </button>
          </Form>
        </MenuItem>
      </Menu>
    </ThemeProvider>
  );
}