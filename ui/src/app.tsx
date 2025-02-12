import * as React from 'react';
import {useEffect, useState} from 'react';
import Button from '@mui/material/Button';
import {createDockerDesktopClient} from '@docker/extension-api-client';
import {Autocomplete, Backdrop, Grid, Stack, TextField, Typography} from '@mui/material';
import {copyTextToClipboard} from "./utils/clipboard";
import {alpha, styled} from '@mui/material/styles';
import ContainerList from "./container-list";
import GithubLoader from "./github-loader";
import {LoadingButton} from '@mui/lab';
import GitHubIcon from '@mui/icons-material/GitHub';

// Note: This line relies on Docker Desktop's presence as a host application.
// If you're running this React app in a browser, it won't work properly.
const client = createDockerDesktopClient();

function useDockerDesktopClient() {
    return client;
}

type GithubUser = {
    login: string;
}

const Search = styled('div')(({theme}) => ({
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(theme.palette.common.white, 0.15),
    '&:hover': {
        backgroundColor: alpha(theme.palette.common.white, 0.25),
    },
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
        marginLeft: theme.spacing(1),
        width: 'auto',
    },
}));

const PackageLoading = () => {
    return <Backdrop open={true}>
        <div
            style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
            }}
        >
            <Stack direction={"column"}
                   justifyContent="center"
                   spacing={2}
                   alignItems="center">
                <GithubLoader/>
                <Typography color={"white"}>
                    Processing...
                </Typography>
            </Stack>
        </div>
    </Backdrop>
}

const Header = () => {
    return <>
        <Typography variant="h3">Github Containers</Typography>
        <Typography variant="body1" color="text.secondary" sx={{mt: 2}}>
            Plugin that you can easily manage your Github Containers and Images and manage your organizations'
            images
        </Typography>
    </>
}

export function App() {
    const [state, setState] = useState("app-loading")
    const [authCode, setAuthCode] = useState();
    const [me, setMe] = useState<GithubUser>();
    const ddClient = useDockerDesktopClient();
    const [organizations, setOrganizations] = useState([])
    const [selectedOrganization, setSelectedOrganization] = useState<any>()
    const [packages, setPackages] = useState([])
    const [packageLoading, setPackageLoading] = useState(false)

    const auth = async () => {
        setState("auth-loading")
        const userCode: string | any = await ddClient.extension.vm?.service?.get('/auth');

        if (userCode) {
            setAuthCode(userCode)
            await copyTextToClipboard(userCode)
            setTimeout(() => {
                setState("auth-approve-request")
                ddClient.host.openExternal("https://github.com/login/device")
            }, 3000);
            return
        } else {
            setState("idle")
        }
    };

    const completeAuth = async () => {
        try {
            await ddClient.extension.vm?.service?.get('/auth/complete');
        } catch (e) {
            client.desktopUI.toast.error("Cannot login to Github");
        }

        checkAuth();
    };

    const getOrganizations = async (me) => {
        const result: [] | any = await ddClient.extension.vm?.service?.get('/organizations');
        const orgs = result.map((org: any) => ({
            id: org.id,
            label: org.login
        }));

        if (me) {
            setOrganizations([...orgs, {
                id: me?.login,
                label: me?.login
            }
        ])
        } else {
            setOrganizations(orgs)
        }


        if (orgs.length > 0) {
            await onOrganizationChange(null, orgs[0])
        }
    };

    const getPackages = async (org: any) => {
        const result: [] | any = await ddClient.extension.vm?.service?.get(`/packages?organizationId=${org.id}`);
        setPackages(result.packages)
    }

    const onOrganizationChange = async (event, value) => {
        setPackageLoading(true)
        setSelectedOrganization(value)
        await getPackages(value)
        setPackageLoading(false)
    }

    const checkAuth = () => {
        setState("app-loading")
        ddClient.extension.vm?.service?.get('/me').then(async (result: any) => {
            setMe(result)
            await getOrganizations(result);
            setState("idle")
        }).catch(err => {
            setMe(null)
            setState("idle")
        })
    }

    const logout = async () => {
        await ddClient.extension.vm?.service?.get('/logout');
        checkAuth()
    }

    const reload = async () => {
        await onOrganizationChange(null, selectedOrganization)
    }

    useEffect(() => {
        if (!window) return

        setTimeout(() => {
            checkAuth();
        }, 2 * 1000)
    }, [])

    const Main = () => {
        return me ? (
            <>
                {packageLoading && <PackageLoading/>}
                <Grid container spacing={2}>
                    <Grid item xs={10}>
                        <Header/>
                    </Grid>
                    <Grid item xs={2}>
                        <Button variant="contained" color={"error"} onClick={logout}>
                            Logout @{me?.login}
                        </Button>
                    </Grid>
                </Grid>

                <Stack spacing={2} sx={{mt: 4}}>
                    <Search>
                        <Autocomplete
                            placeholder={"Organization"}
                            options={organizations}
                            value={selectedOrganization}
                            onChange={onOrganizationChange}
                            renderInput={(params) => <TextField {...params} label="Your Organization"/>}
                        />
                    </Search>
                </Stack>
                {selectedOrganization && packages && packages.length > 0 &&
                    <Stack style={{height: "%100", flexGrow: 1}} direction="row" alignItems="start" spacing={2}
                           sx={{mt: 4}}>
                        <ContainerList user={me} onChange={reload} setState={setPackageLoading} client={client}
                                       packages={packages}/>
                    </Stack>
                }
            </>
        ) : (
            <>
                <Header/>
                <div
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)'
                    }}
                >
                    <Stack direction={"column"}
                           justifyContent="center"
                           spacing={2}
                           alignItems="center">
                        <GithubLoader/>
                        <Typography>
                            {state === "auth-approve-request" ? "Code copied to clipboard. Paste to Github and grant access your organizations" : "Login to Github and Manage your containers"}
                        </Typography>

                        {state === "auth-approve-request" && <TextField
                            sx={{width: 250}}
                            disabled={true}
                            multiline
                            variant="outlined"
                            minRows={0}
                            value={authCode}
                            type={"text"}
                            InputProps={{
                                style: {
                                    fontSize: 40,
                                }
                            }}
                        />}

                        <LoadingButton startIcon={<GitHubIcon/>}
                                       loading={state === "auth-loading"} loadingPosition="start" variant="contained"
                                       onClick={state === "auth-approve-request" ? completeAuth : auth}>
                            {state === "auth-approve-request" ? "Complete" : "Login"}
                        </LoadingButton>
                    </Stack>
                </div>
            </>
        );
    }

    return state === "app-loading" ? (
        <div
            style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
            }}
        >
            <Stack direction={"column"}
                   justifyContent="center"
                   spacing={2}
                   alignItems="center">
                <GithubLoader/>
                <Typography>
                    Github Registry is Loading...
                </Typography>
            </Stack>
        </div>
    ) : <Main/>
}
