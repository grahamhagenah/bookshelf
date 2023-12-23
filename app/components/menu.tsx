import { Form } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs  } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import * as React from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { getUserById } from "~/models/user.server";
import ImportContactsIcon from '@mui/icons-material/ImportContacts';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import GroupIcon from '@mui/icons-material/Group';
import LogoutIcon from '@mui/icons-material/Logout';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import { shadows } from '@mui/system';

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
      <Button sx={{ fontWeight: 'bold', textTransform: 'capitalize', letterSpacing: '1px', color: 'black' }}
        id="account-menu-button"
        aria-controls={open ? 'demo-positioned-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleClick}
      >
        <AccountCircleIcon style={{ fontSize: 30, color: 'black' }}  className="mr-2" />
        {data.user ? data.user.firstname: <span className="whitespace-nowrap">Log In</span>}
      </Button>
      <Menu
        id="account-menu"
        disableScrollLock={ true }
        sx={{ boxShadow: 1 }}
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
            <ImportContactsIcon className="mr-2 mb-1" />
            <button className="stretched-link">
              My Library
            </button>
          </a>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <a href="/search">
            <ManageSearchIcon className="mr-2 mb-1" />
            <button className="stretched-link">
             Book Search 
            </button>
          </a>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <a href="/account">
            <SettingsIcon className="mr-2 mb-1" />
            <button className="stretched-link">
              Account Settings
            </button>
          </a>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <GroupIcon className="mr-2 mb-1" />
          <a href="/friends">
            <button className="stretched-link">
              Friends
            </button>
          </a>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <Form action="/logout" method="post">
            <LogoutIcon className="mr-2 mb-1" />
            <button className="stretched-link" type="submit">
              Logout
            </button>
          </Form>
        </MenuItem>
      </Menu>
    </>
  );
}