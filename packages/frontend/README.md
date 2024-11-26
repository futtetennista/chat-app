# Frontend

## React Scripts

The `react-scripts` CLI is not configurable and it expects your project to follow some conventions e.g.

- Having a `public/index.html` file
- Having a `tsconfig.json` file

among other conventions.
In order to have different configurations for dev and prod builds, we need to do some renaming / symlinking etc.
to make sure that those conventions are followed AND we have different behaviours in different dev environments.
