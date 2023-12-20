import { Form } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs  } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import * as React from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { getUserById } from "~/models/user.server";
import {createTheme, ThemeProvider } from '@mui/material/styles';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return {user};
}

export default function PositionedMenu() {

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
    <>
      <Button
        id="account-menu-button"
        aria-controls={open ? 'demo-positioned-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
      >
        <AccountCircleIcon style={{ fontSize: 30, color: 'black' }}  className="mr-2" />
        {data.user ? data.user.firstname: <span>Log In</span>}
      </Button>
      <Menu
        id="account-menu"
        aria-labelledby="account-menu"
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
    </>
  );
}