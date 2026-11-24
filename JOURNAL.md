# November 23: Planning
I'm not even going to build it the same way as the old project, I'll figure it out based on what components I want:

### 2D Home Screen
Images, a play button followed by instructions to play, the game gets prompted by a start button
The game begins with the same animation, zooming into the crosswalk sign, which changes from a red hand to the walking symbol, prompting the walking-ticking noise, then the actual game will begin

For the rest of the game's functionality, I think I'll have to use React so I can render the 3D assets in Vite, so for the landing page's simpler, 2D part, I can just use JS.

### Gameplay/mechanics
Rules: freezing the wrong player deducts your time by 10s, freezing the right player adds 10s, at the end of the game, whoever was not frozen throws snowballs back at the user (and they receive a log of who they missed)

Gameplay: once the crosswalk sign turns to walking, the Miis enter the viewport and meander around the crosswalk, occasionally bumping into each other and 'mingling'. Hovering on a Mii's body highlights them in blue, enlarges their head, and points their head towards the camera. Holding and dragging a Mii by the head lifts them by their head (they raise their hand as well), and allows users to move them horizontally across the screen (to move them out of the way). When a user clicks on a suspected Mii, they come closer to the viewport, and their LinkedIn on a phone is displayed. This is a scrollable widget with static information. Currently, users can click the "Freeze" button underneath the phone, 

### Assets
#### 2D Art
+ Starting screen
+ UI

#### 3D models
+ Miis

I'll start by creating a fresh react app in this branch.

I ran ```npm install --save-dev @types/react @types/react-dom``` for the most recent Typescript

I don't remember it being this hard to navigate to the commands to create a react app, but it's [here](https://react.dev/learn/creating-a-react-app), I need to figure out whether to use Next.js [or](https://www.reddit.com/r/reactjs/comments/1lhl33w/react_router_v7_or_nextjs_for_building_a/) React Router, I'm seeing a lot more praise for RR7, so I'll install it: ```npx create-react-router@latest``` I don't think I needed to run the previous command (latest version of typescript), as installing RR7 asked to overwrite it. That was actually a bad idea altogether because different dependencies can cause conflicts.