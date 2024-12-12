import React, { FC, useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getCookie } from 'typescript-cookie';
import axios from 'axios';

// Local
import Portfolio from '../components/Portfolio';
import Sidebar from '../components/Sidebar';

const imgUrl: string = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgDw7HXLDZfXQoJReyeHR8IqyPYAp6RWpjs4Dp9MwZ49HoJl2RsXRTGxqnUlzPgtFTbsA7a2upeCQeyPg-2w5qEmpBOxlPkqbfGv48AFW1OyNZ6WIuZt5dI-NVtflu1NPjqE8oJUi4I57oMVtiAStrRnmgjjAf5WQ6_sbd8UYoDhloMBdSRnpIgjY6EdOML/s1920/photo_6291852644980997101_w.jpg";

const Profile: FC = () => {
    const { user } = useParams();
    const navigate = useNavigate();
    const [username, setUsername] = useState<string | null>(null);
    const [isUsersProfile, setIsUsersProfile] = useState<boolean | null>(null);
    
    const [pageNum, setPageNum] = useState<number>(0);
    const [followerCount, setFollowerCount] = useState<number | null>(null);
    const [followingCount, setFollowingCount] = useState<number | null>(null);
    const [followers, setFollowers] = useState<Array<string>>([]);
    const [following, setFollowing] = useState<Array<string>>([]);
    const [showFollowing, setShowFollowing] = useState<boolean>(false);

    const toggleOverlay: (
        e: React.MouseEvent<HTMLButtonElement | HTMLDivElement, MouseEvent>,
        path: string,
    ) => void = (
        e: React.MouseEvent<HTMLButtonElement | HTMLDivElement, MouseEvent>,
        path: string,
    ):void => {
        const card = document.querySelector(path) as HTMLElement;
        const styles = window.getComputedStyle(card);
        
        if (styles.display === 'none') { card.style.display= 'flex'; }
        else if (styles.display === 'flex') { card.style.display= 'none'; }
    };

    useEffect(() => {
        user === localStorage.getItem('username') 
        ? setIsUsersProfile(true) 
        : setIsUsersProfile(false);
    }, []);


    useEffect(() => {
        const fetchData = async() => {
            try
            {
                if (isUsersProfile !== null)
                {
                    let url = `http://127.0.0.1:8000/accounts/metrics?page=${pageNum}`;
                    isUsersProfile ? url = url : url += `&username=${user}`;
                    console.log(url)
    
                    const { data } = await axios.get(
                        url,
                        { headers: { 'Authorization': `Bearer ${getCookie('jwt')}` } },
                    )
                    setFollowerCount(data?.followers.count);
                    setFollowingCount(data?.following.count);
                    setFollowers(data?.followers.entities);
                    setFollowing(data?.following.entities);
                }
            } catch(e)
            {
                if (e instanceof axios.AxiosError)
                {
                    e.status === 403 ? navigate("/404", { replace: true }) : null
                }
            }
        };

        fetchData();
    }, [isUsersProfile]);


    useEffect(() => {
        const header: HTMLElement = document.querySelector('.main-content') as HTMLElement;
        header?.classList.add('profile');
        const styles: Array<HTMLElement> = [];

        const style = document.createElement('style');
        style.innerHTML = `
            .profile::before {
                background-image: url(${imgUrl});
            }
        `;

        styles.push(style);

        if (isUsersProfile) {
            const editProfileStyle: HTMLElement = document.createElement('style');
            
            editProfileStyle.innerHTML = `
                .edit-profile-card .card .container.header-img {
                    border: 2px solid grey;
                    border-radius: 0.5rem;
                    height: 10rem;
                    background-image: url(${imgUrl});
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                }
            `;
            styles.push(editProfileStyle);
        }

        styles.forEach(item => document.head.appendChild(item));

        return () => {
            header?.classList.remove('profile');
            styles.forEach(item => document.head.removeChild(item));
        }
    }, [isUsersProfile]);

    const imgUrl: string = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgDw7HXLDZfXQoJReyeHR8IqyPYAp6RWpjs4Dp9MwZ49HoJl2RsXRTGxqnUlzPgtFTbsA7a2upeCQeyPg-2w5qEmpBOxlPkqbfGv48AFW1OyNZ6WIuZt5dI-NVtflu1NPjqE8oJUi4I57oMVtiAStrRnmgjjAf5WQ6_sbd8UYoDhloMBdSRnpIgjY6EdOML/s1920/photo_6291852644980997101_w.jpg";

    return (
        <Sidebar mainContent={
            <>
            
                {/* Following */}
                <div className="overlay-card following-card">
                    <div className="container">
                        <div className="card">
                            <div className="card-tile" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                                <div>
                                    <h1>{ showFollowing ? 'Following' : 'Followers' }</h1>
                                </div>
                                <button className="transparent" onClick={(e) => { toggleOverlay(e, '.overlay-card.following-card') }}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div className="card-body">
                                { 
                                    showFollowing
                                    ? (
                                        following.map(item => ( 
                                            <Link key={item} to={`/dashboard/profile/${item}`}>
                                                <div className="container flex w-100 search-result">
                                                    <div className="profile img-container title-group small">
                                                        <img src={item} alt="profile" />
                                                    </div>
                                                    <div className="username">
                                                        <span>{item}</span>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))
                                    ) 
                                    : (
                                        followers.map(item => ( 
                                            <Link key={item} to={`/dashboard/profile/${item}`}>
                                                <div className="container flex w-100 search-result">
                                                    <div className="profile img-container title-group small">
                                                        <img src={imgUrl} alt="profile" />
                                                    </div>
                                                    <div className="username">
                                                        <span>{item}</span>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))
                                    )
                                }
                            </div>
                        </div>
                    </div>
                </div>
                {/* Settings */}
                <div className="overlay-card account-settings-card">
                    <div className="container">
                        <div className="card">
                            <div className="card-title space-between">
                                <h2>Settings</h2>
                                <button className="transparent" onClick={(e) => { toggleOverlay(e, '.overlay-card.account-settings-card') }}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div className="card-body"></div>
                        </div>
                    </div>
                </div>
                {/* Edit Profile */}
                <div className="overlay-card edit-profile-card">
                    <div className="container">
                        <div className="card">
                            <div className="card-title space-between">
                                <button className="transparent" onClick={(e) => { toggleOverlay(e, '.overlay-card.edit-profile-card') }}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                                <button className="btn btn-primary" style={{ width: 'auto' }}>Save</button>
                            </div>
                            <div 
                                className="container header-img" 
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',  
                                }}>
                                    <div 
                                        className="transparent" 
                                        style={{ 
                                            backgroundColor: 'rgba(235, 194, 215, 0.6)', 
                                            borderRadius: '10rem', 
                                            width: '5rem', 
                                            height: '5rem',
                                            display: 'flex', 
                                            justifyContent: 'center', 
                                            alignItems: 'center'
                                        }}>
                                        <i className="fa-solid fa-camera" style={{ fontSize: '2rem' }}></i>
                                    </div>                        
                            </div>

                            <div className="card-body" style={{ display: 'flex', flexDirection:'column', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="profile img-container title-group">
                                    <img src={imgUrl} alt="" />
                                </div>
                                <div className="container">
                                    <form>
                                        <input type="text" value={user} onChange={(e) => setUsername(e.target.value)}/>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Main Content */}
                <div className="container profile-container">
                    <div className="inner-card">
                        <div className="card flex">
                            <div className="card-title">
                                <div className="row">
                                    <div className="profile img-container title-group">
                                        <img src={imgUrl} alt="" />
                                    </div>
                                    <div className="title-group">
                                        <span id="username">{user}</span>
                                    </div>
                                </div>
                                <div className="row info">
                                    <div className="container">
                                        <div className="title-info-item" onClick={(e) => { toggleOverlay(e, '.overlay-card.following-card'); setShowFollowing(false); }}>
                                            <div className="title-info-header">
                                                <span>Followers</span>
                                            </div>
                                            <div className="title-info-content">
                                                <span>{followerCount}</span>
                                            </div>
                                        </div>
                                        <div className="title-info-item" onClick={(e) => { toggleOverlay(e, '.overlay-card.following-card'); setShowFollowing(true); }}>
                                            <div className="title-info-header">
                                                <span>Following</span>
                                            </div>
                                            <div className="title-info-content">
                                                <span>{followingCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {
                                        isUsersProfile
                                        ? (
                                            <>
                                                <div className="container">
                                                    <button 
                                                        className='btn btn-secondary'
                                                        onClick={(e) => { toggleOverlay(e, '.overlay-card.edit-profile-card') }}
                                                        >Edit Profile</button>
                                                    <button className="transparent" onClick={(e) => { toggleOverlay(e, '.overlay-card.account-settings-card') }}>
                                                        <i className="fa-solid fa-gear"></i>
                                                    </button>
                                                </div>
                                            </>
                                        )
                                        :(
                                            <>
                                                <div className="container">
                                                    <button 
                                                        className="btn btn-secondary follow-btn"
                                                    >Follow</button>
                                                </div>
                                            </>
                                        )
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                { 
                    isUsersProfile !== null 
                    ? <Portfolio isUsersProfile={isUsersProfile} username={user!}/> 
                    : null
                }
            </>
        } />
    )
};


export default Profile;
