import is from "@sindresorhus/is";
import { Router } from "express";
import { login_required } from "../middlewares/login_required";
import { userAuthService } from "../services/userService";
import { upload, nameField } from "../middlewares/multerMiddleware";
import fs from "fs";
import bodyParser from "body-parser";
const parser = bodyParser.urlencoded({ extended: false });

const userAuthRouter = Router();

userAuthRouter.post("/user/register", async function (req, res, next) {
  try {
    if (is.emptyObject(req.body)) {
      throw new Error(
        "headers의 Content-Type을 application/json으로 설정해주세요"
      );
    }

    // req (request) 에서 데이터 가져오기
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    // 위 데이터를 유저 db에 추가하기
    const newUser = await userAuthService.addUser({
      name,
      email,
      password,
    });

    if (newUser.errorMessage) {
      throw new Error(newUser.errorMessage);
    }

    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});

userAuthRouter.post("/user/login", async function (req, res, next) {
  try {
    // req (request) 에서 데이터 가져오기
    const email = req.body.email;
    const password = req.body.password;

    // 위 데이터를 이용하여 유저 db에서 유저 찾기
    const user = await userAuthService.getUser({ email, password });

    if (user.errorMessage) {
      throw new Error(user.errorMessage);
    }

    res.status(200).send(user);
  } catch (error) {
    next(error);
  }
});

userAuthRouter.get(
  "/userlist",
  login_required,
  async function (req, res, next) {
    try {
      // 전체 사용자 목록을 얻음
      const users = await userAuthService.getUsers();
      res.status(200).send(users);
    } catch (error) {
      next(error);
    }
  }
);

userAuthRouter.get(
  "/user/current",
  login_required,
  async function (req, res, next) {
    try {
      // jwt토큰에서 추출된 사용자 id를 가지고 db에서 사용자 정보를 찾음.
      const user_id = req.currentUserId;
      const currentUserInfo = await userAuthService.getUserInfo({
        user_id,
      });

      if (currentUserInfo.errorMessage) {
        throw new Error(currentUserInfo.errorMessage);
      }

      res.status(200).send(currentUserInfo);
    } catch (error) {
      next(error);
    }
  }
);

userAuthRouter.put(
  "/users/:id",
  login_required,
  async function (req, res, next) {
    try {
      // URI로부터 사용자 id를 추출함.
      const user_id = req.params.id;
      // body data 로부터 업데이트할 사용자 정보를 추출함.
      const name = req.body.name ?? null;
      const email = req.body.email ?? null;
      const password = req.body.password ?? null;
      const description = req.body.description ?? null;

      const toUpdate = { name, email, password, description };

      // 해당 사용자 아이디로 사용자 정보를 db에서 찾아 업데이트함. 업데이트 요소가 없을 시 생략함
      const updatedUser = await userAuthService.setUser({ user_id, toUpdate });

      if (updatedUser.errorMessage) {
        throw new Error(updatedUser.errorMessage);
      }

      res.status(200).json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

//검색
userAuthRouter.get('/users/search', login_required, async (req, res, next) => {
  try {
    const query = {}
    //한글 깨져서 오는것 decode
    if (req.query.name) {
      query.name = { $regex: decodeURIComponent(req.query.name) }
    }
    if (req.query.email) {
      query.email = { $regex: decodeURIComponent(req.query.email) }
    }
    if (!(query.name || query.email)) {
      throw new Error('쿼리를 정확하게 입력해 주세요.')
    }
    const result = await userAuthService.getUsers(query)
    res.status(200).send(result)
  } catch (err) {
    next(err)
  }
})

userAuthRouter.get(
  "/users/:id",
  login_required,
  async function (req, res, next) {
    try {
      const user_id = req.params.id;
      const currentUserInfo = await userAuthService.getUserInfo({ user_id });

      if (currentUserInfo.errorMessage) {
        throw new Error(currentUserInfo.errorMessage);
      }

      res.status(200).send(currentUserInfo);
    } catch (error) {
      next(error);
    }
  }
);

userAuthRouter.get(
  "/userLists",
  login_required,
  async function (req, res, next) {
    try {
      const { page, limit } = req.query;
      // 특정 페이지의 사용자 목록을 얻음
      const users = await userAuthService.getUsersbyPage({ page, limit });

      if(users?.errorMessage) {
        throw new Error(users.errorMessage);
      }

      res.status(200).send(users);
    } catch (error) {
      next(error);
    }
  }
);

// jwt 토큰 기능 확인용, 삭제해도 되는 라우터임.
userAuthRouter.get("/afterlogin", login_required, function (req, res, next) {
  res
    .status(200)
    .send(
      `안녕하세요 ${req.currentUserId}님, jwt 웹 토큰 기능 정상 작동 중입니다.`
    );
});

//로그인 유저의 프로필 사진 수정
userAuthRouter.post('/profileimg', login_required, upload.single(nameField), async function (req, res, next){
  try{
    const filePath = req.file.path; // 파일 전체 경로
    const imgBuffer = fs.readFileSync(filePath); //filePath에 위치한 파일을 "문자열(string)" or 버퍼(binary데이터)으로 가져온다.
    const contentType = req.file.mimetype;
    const img = { 
      data: imgBuffer,
      contentType,
    }
    const userId = req.currentUserId;
    
    const updatedResult = await userAuthService.setUserImg({ userId, img, filePath });

    if(updatedResult.errorMessage){
      throw new Error(updatedResult.errorMessage);
    }
    
    res.status(200).send(updatedResult);
 } catch(error) {
    next(error);
 }
})

//로그인 유저의 프로필 사진 조회
userAuthRouter.get('/profileimg', login_required, async function (req, res, next){
  try{
    const currentUserId = req.currentUserId;
    
    const userImg = await userAuthService.getUserImg({ user_id: currentUserId });

    if(userImg.errorMessage){
      throw new Error(userImg.errorMessage);
    }
    
    res.status(200).send(userImg);
 } catch(error) {
    next(error);
 }
})

//특정 유저의 프로필 사진 조회
userAuthRouter.get('/profileimgs/:id', login_required, async function (req, res, next){
  try{
    const user_id = req.params.id;
    
    const userImg = await userAuthService.getUserImg({ user_id });

    if(userImg.errorMessage){
      throw new Error(userImg.errorMessage);
    }
    
    res.status(200).send(userImg);
 } catch(error) {
    next(error);
 }
})

export { userAuthRouter };
