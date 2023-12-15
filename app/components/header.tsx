
import { Form, Link } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import logo from "~/images/logo-circle.svg";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import * as React from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { getUserById } from "~/models/user.server";
import Search from "./search"
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { createTheme, ThemeProvider } from '@mui/material/styles';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById({ userId });
  return user;
}

export default function Header() {

  const data = useLoaderData<typeof loader>();

  return (
    <header className="w-full flex items-center justify-between">
      <Link to="/books">
        <img id="logo" src={logo} alt="Lend"/>
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
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <ThemeProvider theme={theme}>
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
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <MenuItem onClick={handleClose}>Profile</MenuItem>
        <MenuItem onClick={handleClose}>My account</MenuItem>
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