module.exports = {
  hash: jest.fn().mockResolvedValue('hashed_password'),
  hashSync: jest.fn().mockReturnValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
  compareSync: jest.fn().mockReturnValue(true),
  genSalt: jest.fn().mockResolvedValue('salt'),
  genSaltSync: jest.fn().mockReturnValue('salt'),
};
